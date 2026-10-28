import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResidentialProject } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CancelBookingDto, ConfirmBookingDto, CreateBookingDto, PayInstallmentDto, QueryBookingsDto, QueryInstallmentsDto } from './dto/booking.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { ScopedActor, num, parseDateOnly, toDateOnly, todayUtc, person } from '../../common/utils/scope.util';

type BookingRow = NonNullable<Awaited<ReturnType<BookingsRepository['findById']>>>;
type InstallmentRow = NonNullable<Awaited<ReturnType<BookingsRepository['findInstallment']>>>;

/** Splits the financed amount evenly; the last installment absorbs the rounding remainder so the plan always sums exactly. */
export function buildPlan(total: number, count: number, first: Date, intervalMonths: number) {
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => ({
    seq: i + 1,
    dueDate: new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i * intervalMonths, first.getUTCDate())),
    amount: i === count - 1 ? total - base * (count - 1) : base,
  }));
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly repo: BookingsRepository,
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async list(project: ResidentialProject, query: QueryBookingsDto, actor: ScopedActor) {
    const and: Prisma.BookingWhereInput[] = [{ unit: { site: { projectId: project.id } } }, this.scope(actor)];
    if (query.site_code) and.push({ unit: { site: { code: query.site_code } } });
    if (query.status) and.push({ status: query.status });
    if (query.search) {
      and.push({ OR: [{ client: { fullName: { contains: query.search, mode: 'insensitive' } } }, { client: { phone: { contains: query.search } } }, { unit: { number: { contains: query.search } } }] });
    }
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([this.repo.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }), this.repo.count(where)]);
    return { data: rows.map((b) => this.toPublic(b)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async get(project: ResidentialProject, id: string, actor: ScopedActor) {
    return this.toPublic(await this.findInScope(project, id, actor));
  }

  /**
   * Books an available unit. The unit row is claimed with a compare-and-swap
   * (available → reserved/sold) inside the transaction, so two reps clicking
   * the same unit at once can never both succeed.
   */
  async create(project: ResidentialProject, dto: CreateBookingDto, actor: ScopedActor) {
    const unit = await this.repo.findUnitWithType(dto.unit_id);
    if (!unit || unit.site.projectId !== project.id) throw new NotFoundException('Unit not found in this project');
    if (!dto.client_id && !dto.client) throw new BadRequestException('Send client_id or client');
    const salesRepId = dto.sales_rep_id ?? actor.userId;
    if (salesRepId !== actor.userId && actor.scope === 'own') throw new ForbiddenException('You can only book under your own name');

    const price = dto.price ?? num(unit.unitType.price);
    const deposit = dto.deposit_amount ?? 0;
    if (dto.installment_plan && !price) throw new BadRequestException('An installment plan needs a price — this unit type has none yet, send price');
    if (price !== null && price !== undefined && deposit > price) throw new BadRequestException('Deposit cannot exceed the price');
    const confirmed = deposit > 0;

    const booking = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.unit.updateMany({ where: { id: unit.id, status: 'available' }, data: { status: confirmed ? 'sold' : 'reserved' } });
      if (claim.count === 0) throw new ConflictException({ code: 'UNIT_NOT_AVAILABLE', message: `Unit ${unit.number} is no longer available` });

      let clientId = dto.client_id;
      if (!clientId && dto.client) {
        const existing = await tx.client.findFirst({ where: { phone: dto.client.phone } });
        clientId = existing?.id ?? (await tx.client.create({ data: { fullName: dto.client.full_name.trim(), phone: dto.client.phone, nationalId: dto.client.national_id } })).id;
      } else if (!(await tx.client.findUnique({ where: { id: clientId! } }))) {
        throw new NotFoundException('Client not found');
      }

      const created = await tx.booking.create({
        data: { unitId: unit.id, clientId: clientId!, salesRepId, price, depositAmount: deposit, status: confirmed ? 'confirmed' : 'pending_deposit', createdBy: actor.userId },
      });
      if (dto.installment_plan && price) {
        const plan = buildPlan(price - deposit, dto.installment_plan.count, parseDateOnly(dto.installment_plan.first_due_date), dto.installment_plan.interval_months ?? 1);
        await tx.installment.createMany({ data: plan.map((p) => ({ bookingId: created.id, ...p })) });
      }
      return created;
    });
    await this.activityLog.record({ actorId: actor.userId, action: 'booking_created', newValue: `${project.key} ${unit.number}`, details: { booking_id: booking.id, confirmed } });
    return this.toPublic((await this.repo.findById(booking.id))!);
  }

  async confirm(project: ResidentialProject, id: string, dto: ConfirmBookingDto, actor: ScopedActor) {
    const b = await this.findInScope(project, id, actor);
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.booking.updateMany({ where: { id, status: 'pending_deposit' }, data: { status: 'confirmed', depositAmount: dto.deposit_amount } });
      if (res.count === 0) throw new ConflictException({ code: 'BOOKING_NOT_PENDING', message: 'Only a booking awaiting its deposit can be confirmed' });
      await tx.unit.update({ where: { id: b.unit.id }, data: { status: 'sold' } });
    });
    await this.activityLog.record({ actorId: actor.userId, action: 'booking_confirmed', newValue: b.unit.number, details: { booking_id: id, deposit: dto.deposit_amount } });
    return this.toPublic((await this.repo.findById(id))!);
  }

  /** Releases the unit. Refused once money has been collected on installments — that needs a refund process, not a cancel. */
  async cancel(project: ResidentialProject, id: string, dto: CancelBookingDto, actor: ScopedActor) {
    const b = await this.findInScope(project, id, actor);
    if (b.installments.some((i) => i.status === 'paid')) {
      throw new ConflictException({ code: 'BOOKING_HAS_PAYMENTS', message: 'Installments were already paid on this booking — it needs a refund, not a cancellation' });
    }
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.booking.updateMany({ where: { id, status: { not: 'cancelled' } }, data: { status: 'cancelled', cancelReason: dto.reason.trim() } });
      if (res.count === 0) throw new ConflictException({ code: 'BOOKING_ALREADY_CANCELLED', message: 'This booking is already cancelled' });
      await tx.installment.deleteMany({ where: { bookingId: id, status: 'due' } });
      await tx.unit.update({ where: { id: b.unit.id }, data: { status: 'available' } });
    });
    await this.activityLog.record({ actorId: actor.userId, action: 'booking_cancelled', newValue: b.unit.number, details: { booking_id: id, reason: dto.reason } });
    return this.toPublic((await this.repo.findById(id))!);
  }

  async installments(project: ResidentialProject, query: QueryInstallmentsDto, actor: ScopedActor) {
    const today = todayUtc();
    const and: Prisma.InstallmentWhereInput[] = [{ booking: { status: { not: 'cancelled' }, unit: { site: { projectId: project.id } } } }, { booking: this.scope(actor) }];
    if (query.site_code) and.push({ booking: { unit: { site: { code: query.site_code } } } });
    if (query.booking_id) and.push({ bookingId: query.booking_id });
    if (query.status === 'paid') and.push({ status: 'paid' });
    if (query.status === 'due') and.push({ status: 'due', dueDate: { gte: today } });
    if (query.status === 'overdue') and.push({ status: 'due', dueDate: { lt: today } });
    if (query.search) and.push({ booking: { client: { fullName: { contains: query.search, mode: 'insensitive' } } } });
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([this.repo.findInstallments({ where, skip, take, orderBy: [{ dueDate: 'asc' }, { seq: 'asc' }] }), this.repo.countInstallments(where)]);
    return { data: rows.map((i) => this.installmentPublic(i, today)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async pay(project: ResidentialProject, id: string, dto: PayInstallmentDto, actor: ScopedActor) {
    const inst = await this.repo.findInstallment(id);
    if (!inst || inst.booking.unit.site.projectId !== project.id) throw new NotFoundException('Installment not found');
    if (inst.booking.status === 'cancelled') throw new ConflictException({ code: 'BOOKING_CANCELLED', message: 'This booking was cancelled' });
    if (dto.amount !== num(inst.amount)) {
      throw new BadRequestException({ code: 'AMOUNT_MISMATCH', message: `The installment is ${num(inst.amount)?.toLocaleString('en-US')} IQD — partial payments are recorded as a separate adjustment, not here` });
    }
    const paidAt = dto.paid_at ? parseDateOnly(dto.paid_at) : todayUtc();
    if (paidAt > todayUtc()) throw new BadRequestException('paid_at cannot be in the future');
    const res = await this.prisma.installment.updateMany({ where: { id, status: 'due' }, data: { status: 'paid', paidAmount: dto.amount, paidAt, receiptNo: dto.receipt_no, recordedBy: actor.userId } });
    if (res.count === 0) throw new ConflictException({ code: 'INSTALLMENT_ALREADY_PAID', message: 'This installment is already paid' });
    await this.activityLog.record({ actorId: actor.userId, action: 'installment_paid', newValue: `${inst.booking.unit.number} #${inst.seq}`, details: { receipt_no: dto.receipt_no, amount: dto.amount } });
    return this.installmentPublic((await this.repo.findInstallment(id))!, todayUtc());
  }

  private scope(actor: ScopedActor): Prisma.BookingWhereInput {
    return actor.scope === 'own' ? { salesRepId: actor.userId } : {};
  }

  private async findInScope(project: ResidentialProject, id: string, actor: ScopedActor): Promise<BookingRow> {
    const b = await this.repo.findById(id);
    if (!b || b.unit.site.projectId !== project.id) throw new NotFoundException('Booking not found');
    if (actor.scope === 'own' && b.salesRep.id !== actor.userId) throw new NotFoundException('Booking not found');
    return b;
  }

  private toPublic(b: BookingRow) {
    const today = todayUtc();
    const paid = b.installments.filter((i) => i.status === 'paid');
    return {
      id: b.id,
      unit: { id: b.unit.id, block: b.unit.block, number: b.unit.number, status: b.unit.status, type_code: b.unit.unitType.code, area_m2: num(b.unit.unitType.areaM2), site: { code: b.unit.site.code, name: b.unit.site.name } },
      client: { id: b.client.id, full_name: b.client.fullName, phone: b.client.phone },
      sales_rep: { id: b.salesRep.id, full_name: b.salesRep.fullName },
      booking_date: toDateOnly(b.bookingDate),
      price: num(b.price),
      deposit_amount: num(b.depositAmount),
      status: b.status,
      cancel_reason: b.cancelReason,
      installments: {
        count: b.installments.length,
        paid: paid.length,
        overdue: b.installments.filter((i) => i.status === 'due' && i.dueDate < today).length,
        collected: paid.reduce((a, i) => a + (num(i.paidAmount) ?? 0), 0),
      },
      created_at: b.createdAt,
    };
  }

  private installmentPublic(i: InstallmentRow, today: Date) {
    const overdue = i.status === 'due' && i.dueDate < today;
    return {
      id: i.id, booking_id: i.bookingId, seq: i.seq, due_date: toDateOnly(i.dueDate), amount: num(i.amount),
      status: overdue ? 'overdue' : i.status, paid_amount: num(i.paidAmount), paid_at: toDateOnly(i.paidAt), receipt_no: i.receiptNo,
      recorded_by: person(i.recordedByUser),
      client: { full_name: i.booking.client.fullName, phone: i.booking.client.phone },
      unit: { number: i.booking.unit.number, site: { code: i.booking.unit.site.code, name: i.booking.unit.site.name } },
    };
  }
}
