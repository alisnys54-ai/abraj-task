import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesRepository } from './roles.repository';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';

@Injectable()
export class RolesService {
  constructor(
    private readonly repo: RolesRepository,
    private readonly prisma: PrismaService,
  ) {}

  list(query: { search?: string }) {
    const where = query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {};
    return this.repo.findMany({ where, orderBy: { name: 'asc' } });
  }

  async getById(id: string) {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(dto: CreateRoleDto, actorId: string) {
    const existing = await this.repo.findByName(dto.name);
    if (existing) throw new ConflictException('A role with this name already exists');

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { name: dto.name, description: dto.description, createdBy: actorId } });
      if (dto.clone_from_role_id) {
        const sourcePermissions = await tx.rolePermission.findMany({ where: { roleId: dto.clone_from_role_id } });
        if (sourcePermissions.length) {
          await tx.rolePermission.createMany({
            data: sourcePermissions.map((p) => ({ roleId: role.id, permissionId: p.permissionId, scope: p.scope, granted: p.granted })),
          });
        }
      }
      return role;
    });
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string) {
    const role = await this.getById(id);
    if (role.isSystemRole && dto.name) {
      throw new ForbiddenException('System-seeded roles (General Manager / Department Manager / Employee) cannot be renamed');
    }
    return this.repo.update(id, { name: dto.name, description: dto.description, updatedByUser: { connect: { id: actorId } } });
  }

  async remove(id: string) {
    const role = await this.getById(id);
    if (role.isSystemRole) throw new ForbiddenException('System-seeded roles cannot be deleted');
    const userCount = await this.repo.countUsers(id);
    if (userCount > 0) throw new ConflictException('Cannot delete a role that still has assigned users');
    await this.repo.delete(id);
  }

  async listUsers(roleId: string, query: PaginationQueryDto) {
    await this.getById(roleId);
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([this.repo.listUsers(roleId, skip, take), this.repo.countUsers(roleId)]);
    return {
      data: rows.map((ur) => ({ id: ur.user.id, full_name: ur.user.fullName, email: ur.user.email })),
      meta: buildPaginationMeta(query.page, query.page_size, total),
    };
  }

  async assignUser(roleId: string, userId: string, actorId: string) {
    await this.getById(roleId);
    await this.repo.assignRole(userId, roleId, actorId);
  }

  async removeUser(roleId: string, userId: string) {
    await this.getById(roleId);
    const remaining = await this.repo.countUserRoles(userId);
    if (remaining <= 1) throw new ConflictException('A user must always retain at least one role');
    await this.repo.removeRole(userId, roleId);
  }
}
