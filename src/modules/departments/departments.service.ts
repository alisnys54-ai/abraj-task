import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { MoveDepartmentDto } from './dto/move-department.dto';
import { QueryDepartmentsDto } from './dto/query-departments.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';

interface DepartmentRow {
  id: string;
  name: string;
  parentDepartmentId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly repo: DepartmentsRepository) {}

  async list(query: QueryDepartmentsDto) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (!query.include_archived) where.isActive = true;
    if (query.parent_department_id !== undefined) where.parentDepartmentId = query.parent_department_id;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([
      this.repo.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.repo.count(where),
    ]);
    return { data: rows.map((d) => this.toPublic(d)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async getById(id: string) {
    const dept = await this.findOrThrow(id);
    const [ancestors, managers] = await Promise.all([this.getAncestorChain(dept.parentDepartmentId), this.repo.listManagers(id)]);
    return {
      ...this.toPublic(dept),
      ancestors,
      managers: managers.map((m) => ({ user_id: m.userId, full_name: m.user.fullName })),
    };
  }

  /** Full nested organization tree with per-node employee/position counts — built for Tree View / drag-and-drop frontends. */
  async getTree(includeArchived = false) {
    const [departments, employeeCounts, positionCounts, managers] = await Promise.all([
      this.repo.findAllActive(),
      this.repo.employeeCountByDepartment(),
      this.repo.positionCountByDepartment(),
      this.repo.managersByDepartment(),
    ]);

    const empCountById = new Map(employeeCounts.map((r) => [r.departmentId, r._count._all]));
    const posCountById = new Map(positionCounts.filter((r) => r.departmentId).map((r) => [r.departmentId as string, r._count._all]));
    const managersById = new Map<string, { user_id: string; full_name: string }[]>();
    for (const m of managers) {
      const list = managersById.get(m.departmentId) ?? [];
      list.push({ user_id: m.userId, full_name: m.user.fullName });
      managersById.set(m.departmentId, list);
    }

    const visible = includeArchived ? departments : departments.filter((d) => d.isActive);
    const byParent = new Map<string | null, DepartmentRow[]>();
    for (const d of visible) {
      const key = d.parentDepartmentId;
      const list = byParent.get(key) ?? [];
      list.push(d);
      byParent.set(key, list);
    }

    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({
          id: d.id,
          name: d.name,
          is_active: d.isActive,
          employee_count: empCountById.get(d.id) ?? 0,
          position_count: posCountById.get(d.id) ?? 0,
          managers: managersById.get(d.id) ?? [],
          children: build(d.id),
        }));

    return build(null);
  }

  async create(dto: CreateDepartmentDto, actorId: string) {
    const existing = await this.repo.findByName(dto.name);
    if (existing) throw new ConflictException('A department with this name already exists');
    if (dto.parent_department_id) await this.findOrThrow(dto.parent_department_id);

    const created = await this.repo.create({
      name: dto.name,
      createdByUser: { connect: { id: actorId } },
      ...(dto.parent_department_id ? { parentDepartment: { connect: { id: dto.parent_department_id } } } : {}),
    });
    return this.toPublic(created);
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId: string) {
    await this.findOrThrow(id);
    if (dto.name) {
      const existing = await this.repo.findByName(dto.name);
      if (existing && existing.id !== id) throw new ConflictException('A department with this name already exists');
    }
    return this.toPublic(await this.repo.update(id, { name: dto.name, updatedByUser: { connect: { id: actorId } } }));
  }

  /** Moves a department to a new parent (or makes it a root). Rejects any move that would create a cycle. */
  async move(id: string, dto: MoveDepartmentDto, actorId: string) {
    await this.findOrThrow(id);
    const newParentId = dto.parent_department_id ?? null;
    if (newParentId) await this.findOrThrow(newParentId);
    await this.assertNoCycle(id, newParentId);

    const updated = await this.repo.update(id, {
      updatedByUser: { connect: { id: actorId } },
      parentDepartment: newParentId ? { connect: { id: newParentId } } : { disconnect: true },
    });
    return this.toPublic(updated);
  }

  async archive(id: string, actorId: string) {
    await this.findOrThrow(id);
    return this.toPublic(await this.repo.update(id, { isActive: false, updatedByUser: { connect: { id: actorId } } }));
  }

  async restore(id: string, actorId: string) {
    await this.findOrThrow(id);
    return this.toPublic(await this.repo.update(id, { isActive: true, updatedByUser: { connect: { id: actorId } } }));
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    const [children, users, tasks] = await Promise.all([
      this.repo.countChildren(id),
      this.repo.countActiveUsers(id),
      this.repo.countActiveTasks(id),
    ]);
    if (children > 0) throw new ConflictException('Cannot delete a department that still has child departments — move or delete them first');
    if (users > 0) throw new ConflictException('Cannot delete a department that still has active users assigned');
    if (tasks > 0) throw new ConflictException('Cannot delete a department that still has active tasks');
    await this.repo.softDelete(id);
  }

  async listManagers(id: string) {
    await this.findOrThrow(id);
    const rows = await this.repo.listManagers(id);
    return rows.map((m) => ({ user_id: m.userId, full_name: m.user.fullName, assigned_at: m.assignedAt }));
  }

  async addManager(id: string, dto: AssignManagerDto, actorId: string) {
    await this.findOrThrow(id);
    await this.repo.addManager(id, dto.user_id, actorId);
  }

  async removeManager(id: string, userId: string) {
    await this.findOrThrow(id);
    await this.repo.removeManager(id, userId);
  }

  /** Used by Positions/UserTransfers to validate a target department without duplicating the lookup. */
  async assertActiveDepartment(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept || !dept.isActive) throw new BadRequestException('Target department does not exist or is archived');
    return dept;
  }

  private async findOrThrow(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  private async getAncestorChain(parentId: string | null) {
    const chain: { id: string; name: string }[] = [];
    let cursor = parentId;
    while (cursor) {
      const parent = await this.repo.findById(cursor);
      if (!parent) break;
      chain.unshift({ id: parent.id, name: parent.name });
      cursor = parent.parentDepartmentId;
    }
    return chain;
  }

  /** Walks up from the proposed new parent; if the department being moved appears in that
   *  chain, the move would create a cycle. O(depth) — fine at any realistic org depth. */
  private async assertNoCycle(departmentId: string, newParentId: string | null) {
    if (!newParentId) return;
    if (newParentId === departmentId) throw new BadRequestException('A department cannot be its own parent');
    let cursor: string | null = newParentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === departmentId) throw new BadRequestException('This move would create a circular department hierarchy');
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const parent = await this.repo.findById(cursor);
      cursor = parent?.parentDepartmentId ?? null;
    }
  }

  private toPublic(d: DepartmentRow) {
    return {
      id: d.id,
      name: d.name,
      parent_department_id: d.parentDepartmentId,
      is_active: d.isActive,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    };
  }
}
