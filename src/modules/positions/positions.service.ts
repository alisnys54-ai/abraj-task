import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PositionsRepository } from './positions.repository';
import { DepartmentsService } from '../departments/departments.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { QueryPositionsDto } from './dto/query-positions.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';

interface PositionRow {
  id: string;
  title: string;
  departmentId: string | null;
  isArchived: boolean;
  createdAt: Date;
}

@Injectable()
export class PositionsService {
  constructor(
    private readonly repo: PositionsRepository,
    private readonly departments: DepartmentsService,
  ) {}

  async list(query: QueryPositionsDto) {
    const where: Record<string, unknown> = {};
    if (!query.include_archived) where.isArchived = false;
    if (query.department_id) where.departmentId = query.department_id;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([
      this.repo.findMany({ where, skip, take, orderBy: { title: 'asc' } }),
      this.repo.count(where),
    ]);
    return { data: rows.map((p) => this.toPublic(p)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async getById(id: string) {
    const position = await this.findOrThrow(id);
    return this.toPublic(position);
  }

  async create(dto: CreatePositionDto, actorId: string) {
    if (dto.department_id) await this.departments.assertActiveDepartment(dto.department_id);
    const existing = await this.repo.findByTitleInDepartment(dto.title, dto.department_id ?? null);
    if (existing) throw new ConflictException('This position title already exists in that department');

    const created = await this.repo.create({
      title: dto.title,
      createdByUser: { connect: { id: actorId } },
      ...(dto.department_id ? { department: { connect: { id: dto.department_id } } } : {}),
    });
    return this.toPublic(created);
  }

  async update(id: string, dto: UpdatePositionDto) {
    await this.findOrThrow(id);
    if (dto.department_id) await this.departments.assertActiveDepartment(dto.department_id);

    const updated = await this.repo.update(id, {
      title: dto.title,
      ...(dto.department_id !== undefined
        ? { department: dto.department_id ? { connect: { id: dto.department_id } } : { disconnect: true } }
        : {}),
    });
    return this.toPublic(updated);
  }

  async archive(id: string) {
    await this.findOrThrow(id);
    return this.toPublic(await this.repo.update(id, { isArchived: true }));
  }

  async restore(id: string) {
    await this.findOrThrow(id);
    return this.toPublic(await this.repo.update(id, { isArchived: false }));
  }

  private async findOrThrow(id: string) {
    const position = await this.repo.findById(id);
    if (!position) throw new NotFoundException('Position not found');
    return position;
  }

  private toPublic(p: PositionRow) {
    return { id: p.id, title: p.title, department_id: p.departmentId, is_archived: p.isArchived, created_at: p.createdAt };
  }
}
