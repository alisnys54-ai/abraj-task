import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LeavesRepository } from './leaves.repository';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateLeaveDto, DecideLeaveDto, QueryLeavesDto } from './dto/leave.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { ScopedActor, num, parseDateOnly, toDateOnly, person } from '../../common/utils/scope.util';

type LeaveRow = NonNullable<Awaited<ReturnType<LeavesRepository['findById']>>>;

@Injectable()
export class LeavesService {
  constructor(
    private readonly repo: LeavesRepository,
    private readonly employees: EmployeesService,
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async list(query: QueryLeavesDto, actor: ScopedActor) {
    const and: Prisma.LeaveRequestWhereInput[] = [{ employee: await this.employees.scopeWhere(actor) }];
    if (query.status) and.push({ status: query.status });
    if (query.employee_id) and.push({ employeeId: query.employee_id });
    if (query.department_id) and.push({ employee: { departmentId: query.department_id } });
    if (query.search) and.push({ employee: { fullName: { contains: query.search, mode: 'insensitive' } } });
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([
      this.repo.findMany({ where, skip, take, orderBy: [{ status: 'asc' }, { startDate: 'desc' }] }),
      this.repo.count(where),
    ]);
    return { data: rows.map((r) => this.toPublic(r)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async create(dto: CreateLeaveDto, actor: ScopedActor) {
    if (dto.type === 'hourly' ? !dto.hours : !dto.days) {
      throw new BadRequestException(dto.type === 'hourly' ? 'hours is required for hourly leave' : 'days is required for this leave type');
    }
    // Filing for yourself needs no scope beyond `own`; filing for someone else must be within your scope.
    const self = await this.prisma.employee.findUnique({ where: { userId: actor.userId } });
    let employeeId = dto.employee_id ?? self?.id;
    if (!employeeId) throw new BadRequestException('Your login is not linked to an employee record — ask HR to link it');
    if (employeeId !== self?.id) employeeId = (await this.employees.findInScope(employeeId, actor)).id;

    const startDate = parseDateOnly(dto.start_date);
    if (await this.repo.findOpenOnDate(employeeId, startDate)) {
      throw new ConflictException({ code: 'LEAVE_OVERLAP', message: 'There is already a pending or approved leave starting that day' });
    }
    const created = await this.repo.create({
      employeeId,
      type: dto.type,
      startDate,
      days: dto.type === 'hourly' ? null : dto.days,
      hours: dto.type === 'hourly' ? dto.hours : null,
      reason: dto.reason,
      requestedBy: actor.userId,
    });
    await this.activityLog.record({ actorId: actor.userId, action: 'leave_requested', newValue: `${created.employee.fullName} · ${dto.type} · ${dto.start_date}` });
    return this.toPublic(created);
  }

  async decide(id: string, dto: DecideLeaveDto, actor: ScopedActor) {
    const leave = await this.findInScope(id, actor);
    if (actor.scope === 'own') throw new ForbiddenException('Approving leave needs department or company scope');
    if (leave.employee.userId === actor.userId && !actor.isSystemOwner) {
      throw new ForbiddenException({ code: 'SELF_APPROVAL', message: 'You cannot decide your own leave request' });
    }
    if (dto.decision === 'rejected' && !dto.note?.trim()) throw new BadRequestException('A note is required when rejecting');

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.leaveRequest.updateMany({
        where: { id, status: 'pending' },
        data: { status: dto.decision, decidedBy: actor.userId, decidedAt: new Date(), decisionNote: dto.note },
      });
      if (res.count === 0) throw new ConflictException({ code: 'LEAVE_ALREADY_DECIDED', message: 'This request was already decided' });
      // An approved day-based leave fills the attendance sheet so HR never double-counts it as absence.
      if (dto.decision === 'approved' && leave.days) {
        const days = Math.ceil(num(leave.days) ?? 0);
        for (let i = 0; i < days; i++) {
          const date = new Date(leave.startDate.getTime() + i * 86_400_000);
          await tx.attendanceRecord.upsert({
            where: { employeeId_date: { employeeId: leave.employeeId, date } },
            update: { status: 'on_leave', note: 'إجازة معتمدة', recordedBy: actor.userId },
            create: { employeeId: leave.employeeId, date, status: 'on_leave', note: 'إجازة معتمدة', recordedBy: actor.userId },
          });
        }
      }
    });
    await this.activityLog.record({ actorId: actor.userId, action: `leave_${dto.decision}`, newValue: leave.employee.fullName, details: { leave_id: id, note: dto.note } });
    return this.toPublic((await this.repo.findById(id))!);
  }

  async cancel(id: string, actor: ScopedActor) {
    const leave = await this.findInScope(id, actor);
    const isRequester = leave.requestedBy === actor.userId || leave.employee.userId === actor.userId;
    if (!isRequester && actor.scope === 'own') throw new ForbiddenException('Only the requester or an approver can cancel');
    const res = await this.repo.updateIfStatus(id, 'pending', { status: 'cancelled' });
    if (res.count === 0) throw new ConflictException({ code: 'LEAVE_NOT_PENDING', message: 'Only a pending request can be cancelled' });
    await this.activityLog.record({ actorId: actor.userId, action: 'leave_cancelled', newValue: leave.employee.fullName });
    return this.toPublic((await this.repo.findById(id))!);
  }

  private async findInScope(id: string, actor: ScopedActor): Promise<LeaveRow> {
    const leave = await this.repo.findById(id);
    if (!leave) throw new NotFoundException('Leave request not found');
    await this.employees.findInScope(leave.employeeId, actor);
    return leave;
  }

  private toPublic(r: LeaveRow) {
    return {
      id: r.id,
      employee: { id: r.employee.id, employee_no: r.employee.employeeNo, full_name: r.employee.fullName, department: r.employee.department },
      type: r.type,
      start_date: toDateOnly(r.startDate),
      days: num(r.days),
      hours: num(r.hours),
      reason: r.reason,
      status: r.status,
      requested_by: person(r.requestedByUser),
      decided_by: person(r.decidedByUser),
      decided_at: r.decidedAt,
      decision_note: r.decisionNote,
      created_at: r.createdAt,
    };
  }
}
