import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttendanceRepository } from './attendance.repository';
import { EmployeesService } from '../employees/employees.service';
import { QueryAttendanceDto, RecordAttendanceDto } from './dto/attendance.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { ScopedActor, parseDateOnly, todayUtc } from '../../common/utils/scope.util';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repo: AttendanceRepository,
    private readonly employees: EmployeesService,
  ) {}

  /** One row per in-scope employee for the day, with their record or null — a roll-call sheet. */
  async day(query: QueryAttendanceDto, actor: ScopedActor) {
    const date = parseDateOnly(query.date);
    const and: Prisma.EmployeeWhereInput[] = [await this.employees.scopeWhere(actor), { status: { not: 'terminated' } }];
    if (query.department_id) and.push({ departmentId: query.department_id });
    if (query.site_id) and.push({ siteId: query.site_id });
    if (query.search) and.push({ OR: [{ fullName: { contains: query.search, mode: 'insensitive' } }, { employeeNo: { contains: query.search, mode: 'insensitive' } }] });
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([this.repo.findEmployeesWithDay(where, date, skip, take), this.repo.countEmployees(where)]);
    return {
      data: rows.map((e) => {
        const r = e.attendance[0];
        return {
          employee: { id: e.id, employee_no: e.employeeNo, full_name: e.fullName, department: e.department, site: e.site },
          record: r ? { status: r.status, check_in: r.checkIn, check_out: r.checkOut, note: r.note } : null,
        };
      }),
      meta: buildPaginationMeta(query.page, query.page_size, total),
    };
  }

  async summary(dateStr: string, actor: ScopedActor) {
    const date = parseDateOnly(dateStr);
    const scope = { AND: [await this.employees.scopeWhere(actor), { status: { not: 'terminated' as const } }] };
    const [total, groups] = await Promise.all([this.repo.countEmployees(scope), this.repo.countByStatus(scope, date)]);
    const by = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
    const recorded = groups.reduce((a, g) => a + g._count._all, 0);
    return { date: dateStr, total_employees: total, present: by.present ?? 0, late: by.late ?? 0, absent: by.absent ?? 0, on_leave: by.on_leave ?? 0, not_recorded: Math.max(0, total - recorded) };
  }

  async record(dto: RecordAttendanceDto, actor: ScopedActor) {
    if (actor.scope === 'own') throw new ForbiddenException('Recording attendance needs department or company scope');
    const date = parseDateOnly(dto.date);
    if (date > todayUtc()) throw new ForbiddenException({ code: 'FUTURE_DATE', message: 'Attendance cannot be recorded for a future date' });
    const ids = [...new Set(dto.records.map((r) => r.employee_id))];
    const allowed = new Set((await this.repo.employeeIdsIn(ids, await this.employees.scopeWhere(actor))).map((e) => e.id));
    const outside = ids.filter((id) => !allowed.has(id));
    if (outside.length) throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'Some employees are outside your scope', details: { employee_ids: outside } });
    await this.repo.upsertMany(
      date,
      dto.records.map((r) => ({ employeeId: r.employee_id, status: r.status, checkIn: r.check_in, checkOut: r.check_out, note: r.note })),
      actor.userId,
    );
    return this.summary(dto.date, actor);
  }
}
