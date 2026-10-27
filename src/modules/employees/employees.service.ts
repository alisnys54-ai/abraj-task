import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmployeesRepository } from './employees.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateEmployeeDto, QueryEmployeesDto, UpdateEmployeeDto } from './dto/employee.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { ScopedActor, actorDepartmentId, num, parseDateOnly, toDateOnly } from '../../common/utils/scope.util';

type EmployeeRow = NonNullable<Awaited<ReturnType<EmployeesRepository['findById']>>>;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly repo: EmployeesRepository,
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /** The where-clause that limits a caller to the employees their grant reaches. Exported for attendance/leaves/payroll. */
  async scopeWhere(actor: ScopedActor): Promise<Prisma.EmployeeWhereInput> {
    if (actor.scope === 'all') return {};
    if (actor.scope === 'department') return { departmentId: await actorDepartmentId(this.prisma, actor.userId) };
    return { userId: actor.userId };
  }

  async list(query: QueryEmployeesDto, actor: ScopedActor) {
    const and: Prisma.EmployeeWhereInput[] = [await this.scopeWhere(actor)];
    if (query.department_id) and.push({ departmentId: query.department_id });
    if (query.site_id) and.push({ siteId: query.site_id });
    if (query.status) and.push({ status: query.status });
    if (query.search) and.push({ OR: [{ fullName: { contains: query.search, mode: 'insensitive' } }, { employeeNo: { contains: query.search, mode: 'insensitive' } }, { phone: { contains: query.search } }] });
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([
      this.repo.findMany({ where, skip, take, orderBy: { employeeNo: query.order ?? 'asc' } }),
      this.repo.count(where),
    ]);
    return { data: rows.map((e) => this.toPublic(e)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async getById(id: string, actor: ScopedActor) {
    return this.toPublic(await this.findInScope(id, actor));
  }

  async create(dto: CreateEmployeeDto, actor: ScopedActor) {
    await this.assertDepartmentWritable(dto.department_id, actor);
    const employeeNo = dto.employee_no ?? `AY-${(await this.repo.maxNumber()) + 1}`;
    if (await this.repo.findByNo(employeeNo)) throw new ConflictException({ code: 'EMPLOYEE_NO_TAKEN', message: `${employeeNo} is already used` });
    if (dto.user_id && (await this.repo.findByUserId(dto.user_id))) throw new ConflictException({ code: 'USER_ALREADY_LINKED', message: 'That login is already linked to another employee' });

    const created = await this.repo.create({
      employeeNo,
      fullName: dto.full_name.trim(),
      departmentId: dto.department_id,
      positionId: dto.position_id,
      siteId: dto.site_id,
      workLocation: dto.work_location,
      phone: dto.phone,
      nationalId: dto.national_id,
      hireDate: dto.hire_date ? parseDateOnly(dto.hire_date) : undefined,
      baseSalary: dto.base_salary ?? 0,
      userId: dto.user_id,
      createdBy: actor.userId,
    });
    await this.activityLog.record({ actorId: actor.userId, action: 'employee_created', newValue: `${employeeNo} ${created.fullName}` });
    return this.toPublic(created);
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: ScopedActor) {
    const current = await this.findInScope(id, actor);
    if (actor.scope === 'own') throw new ForbiddenException('You cannot edit employee records');
    if (dto.department_id && dto.department_id !== current.departmentId) await this.assertDepartmentWritable(dto.department_id, actor);
    if (dto.employee_no && dto.employee_no !== current.employeeNo && (await this.repo.findByNo(dto.employee_no))) {
      throw new ConflictException({ code: 'EMPLOYEE_NO_TAKEN', message: `${dto.employee_no} is already used` });
    }
    if (dto.user_id && dto.user_id !== current.userId) {
      const linked = await this.repo.findByUserId(dto.user_id);
      if (linked && linked.id !== id) throw new ConflictException({ code: 'USER_ALREADY_LINKED', message: 'That login is already linked to another employee' });
    }
    const updated = await this.repo.update(id, {
      employeeNo: dto.employee_no,
      fullName: dto.full_name?.trim(),
      departmentId: dto.department_id,
      positionId: dto.position_id,
      siteId: dto.site_id,
      workLocation: dto.work_location,
      phone: dto.phone,
      nationalId: dto.national_id,
      hireDate: dto.hire_date ? parseDateOnly(dto.hire_date) : undefined,
      baseSalary: dto.base_salary,
      status: dto.status,
      userId: dto.user_id,
    });
    await this.activityLog.record({ actorId: actor.userId, action: 'employee_updated', newValue: updated.employeeNo, details: { changed: Object.keys(dto) } });
    return this.toPublic(updated);
  }

  async findInScope(id: string, actor: ScopedActor): Promise<EmployeeRow> {
    const employee = await this.repo.findById(id);
    if (!employee) throw new NotFoundException('Employee not found');
    const where = await this.scopeWhere(actor);
    if (where.departmentId && employee.departmentId !== where.departmentId) throw new NotFoundException('Employee not found');
    if (where.userId && employee.userId !== where.userId) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async assertDepartmentWritable(departmentId: string, actor: ScopedActor) {
    if (actor.scope === 'own') throw new ForbiddenException('You cannot create employee records');
    if (actor.scope === 'department' && departmentId !== (await actorDepartmentId(this.prisma, actor.userId))) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'You can only manage employees in your own department' });
    }
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, deletedAt: null, isActive: true } });
    if (!dept) throw new NotFoundException('Department not found');
  }

  toPublic(e: EmployeeRow) {
    return {
      id: e.id,
      employee_no: e.employeeNo,
      full_name: e.fullName,
      department: e.department,
      position: e.position,
      site: e.site,
      work_location: e.workLocation,
      phone: e.phone,
      national_id: e.nationalId,
      hire_date: toDateOnly(e.hireDate),
      base_salary: num(e.baseSalary),
      status: e.status,
      user_id: e.userId,
      created_at: e.createdAt,
    };
  }
}
