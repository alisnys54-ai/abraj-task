import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PayrollStatus, Prisma } from '@prisma/client';
import { PayrollRepository } from './payroll.repository';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreatePeriodDto, QueryEntriesDto, UpdateEntryDto } from './dto/payroll.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { ScopedActor, num, person } from '../../common/utils/scope.util';

/** draft → review (HR submits) → approved (a different approver) → paid (finance releases). */
const NEXT: Record<'submit' | 'approve' | 'pay', { from: PayrollStatus; to: PayrollStatus }> = {
  submit: { from: 'draft', to: 'review' },
  approve: { from: 'review', to: 'approved' },
  pay: { from: 'approved', to: 'paid' },
};

@Injectable()
export class PayrollService {
  constructor(
    private readonly repo: PayrollRepository,
    private readonly employees: EmployeesService,
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async listPeriods(actor: ScopedActor) {
    const scope = await this.employees.scopeWhere(actor);
    const periods = await this.repo.listPeriods();
    return Promise.all(periods.map(async (p) => this.toPublicPeriod(p, await this.repo.totals(p.id, scope))));
  }

  async getPeriod(id: string, actor: ScopedActor) {
    const p = await this.repo.findPeriod(id);
    if (!p) throw new NotFoundException('Payroll period not found');
    return this.toPublicPeriod(p, await this.repo.totals(id, await this.employees.scopeWhere(actor)));
  }

  async entries(id: string, query: QueryEntriesDto, actor: ScopedActor) {
    if (!(await this.repo.findPeriod(id))) throw new NotFoundException('Payroll period not found');
    const and: Prisma.PayrollEntryWhereInput[] = [{ periodId: id }, { employee: await this.employees.scopeWhere(actor) }];
    if (query.department_id) and.push({ employee: { departmentId: query.department_id } });
    if (query.search) and.push({ employee: { OR: [{ fullName: { contains: query.search, mode: 'insensitive' } }, { employeeNo: { contains: query.search, mode: 'insensitive' } }] } });
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([
      this.repo.findEntries({ where, skip, take, orderBy: { employee: { employeeNo: 'asc' } } }),
      this.repo.countEntries(where),
    ]);
    return {
      data: rows.map((e) => ({
        id: e.id,
        employee: { id: e.employee.id, employee_no: e.employee.employeeNo, full_name: e.employee.fullName, department: e.employee.department },
        base_salary: num(e.baseSalary), allowances: num(e.allowances), deductions: num(e.deductions), advances: num(e.advances), net_pay: num(e.netPay),
      })),
      meta: buildPaginationMeta(query.page, query.page_size, total),
    };
  }

  /** Opens a month as a draft with one entry per active employee at their current base salary. */
  async createPeriod(dto: CreatePeriodDto, actor: ScopedActor) {
    this.assertCompanyScope(actor);
    if (await this.repo.findPeriodByMonth(dto.year, dto.month)) {
      throw new ConflictException({ code: 'PAYROLL_PERIOD_EXISTS', message: `Payroll for ${dto.month}/${dto.year} already exists` });
    }
    const period = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payrollPeriod.create({ data: { year: dto.year, month: dto.month, createdBy: actor.userId } });
      const staff = await tx.employee.findMany({ where: { status: { in: ['active', 'on_leave'] } }, select: { id: true, baseSalary: true } });
      if (staff.length) {
        await tx.payrollEntry.createMany({ data: staff.map((e) => ({ periodId: created.id, employeeId: e.id, baseSalary: e.baseSalary, netPay: e.baseSalary })) });
      }
      return created;
    });
    await this.activityLog.record({ actorId: actor.userId, action: 'payroll_period_created', newValue: `${dto.month}/${dto.year}` });
    return this.getPeriod(period.id, actor);
  }

  async updateEntry(entryId: string, dto: UpdateEntryDto, actor: ScopedActor) {
    this.assertCompanyScope(actor);
    const entry = await this.repo.findEntry(entryId);
    if (!entry) throw new NotFoundException('Payroll entry not found');
    if (!['draft', 'review'].includes(entry.period.status)) {
      throw new ConflictException({ code: 'PAYROLL_LOCKED', message: 'An approved or paid payroll can no longer be edited' });
    }
    const allowances = dto.allowances ?? num(entry.allowances)!;
    const deductions = dto.deductions ?? num(entry.deductions)!;
    const advances = dto.advances ?? num(entry.advances)!;
    const netPay = num(entry.baseSalary)! + allowances - deductions - advances;
    if (netPay < 0) throw new ConflictException({ code: 'NEGATIVE_NET_PAY', message: 'Deductions and advances exceed the salary' });
    const updated = await this.prisma.payrollEntry.update({ where: { id: entryId }, data: { allowances, deductions, advances, netPay } });
    return { id: updated.id, base_salary: num(updated.baseSalary), allowances, deductions, advances, net_pay: netPay };
  }

  async transition(id: string, step: keyof typeof NEXT, actor: ScopedActor) {
    this.assertCompanyScope(actor);
    const period = await this.repo.findPeriod(id);
    if (!period) throw new NotFoundException('Payroll period not found');
    if (step === 'approve' && period.createdBy === actor.userId && !actor.isSystemOwner) {
      throw new ForbiddenException({ code: 'SELF_APPROVAL', message: 'The person who prepared the payroll cannot approve it' });
    }
    const { from, to } = NEXT[step];
    const data: Prisma.PayrollPeriodUncheckedUpdateManyInput = { status: to };
    if (step === 'approve') Object.assign(data, { approvedBy: actor.userId, approvedAt: new Date() });
    if (step === 'pay') Object.assign(data, { paidAt: new Date() });
    const res = await this.prisma.payrollPeriod.updateMany({ where: { id, status: from }, data });
    if (res.count === 0) throw new ConflictException({ code: 'INVALID_PAYROLL_TRANSITION', message: `Payroll must be '${from}' to ${step}; it is '${period.status}'` });
    await this.activityLog.record({ actorId: actor.userId, action: `payroll_${step}`, newValue: `${period.month}/${period.year}` });
    return this.getPeriod(id, actor);
  }

  private assertCompanyScope(actor: ScopedActor) {
    if (actor.scope !== 'all') throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'Payroll changes need company-wide scope' });
  }

  private toPublicPeriod(
    p: NonNullable<Awaited<ReturnType<PayrollRepository['findPeriod']>>>,
    t: Awaited<ReturnType<PayrollRepository['totals']>>,
  ) {
    return {
      id: p.id, year: p.year, month: p.month, status: p.status,
      created_by: person(p.createdByUser), approved_by: person(p.approvedByUser), approved_at: p.approvedAt, paid_at: p.paidAt, created_at: p.createdAt,
      entries_total: p._count.entries,
      visible_entries: t._count._all,
      totals: { base_salary: num(t._sum.baseSalary) ?? 0, allowances: num(t._sum.allowances) ?? 0, deductions: num(t._sum.deductions) ?? 0, advances: num(t._sum.advances) ?? 0, net_pay: num(t._sum.netPay) ?? 0 },
    };
  }
}
