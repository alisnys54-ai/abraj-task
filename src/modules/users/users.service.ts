import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { UserTransfersService } from '../user-transfers/user-transfers.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';

const SORTABLE_COLUMNS: Record<string, string> = { createdAt: 'createdAt', fullName: 'fullName', email: 'email' };

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly userTransfers: UserTransfersService,
  ) {}

  async list(query: QueryUsersDto) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (query.department_id) where.departmentId = query.department_id;
    if (query.status) where.status = query.status;
    if (query.role_id) where.userRoles = { some: { roleId: query.role_id } };
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const sortColumn = SORTABLE_COLUMNS[query.sort ?? ''] ?? 'createdAt';
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([
      this.repo.findMany({ where, skip, take, orderBy: { [sortColumn]: query.order ?? 'desc' } }),
      this.repo.count(where),
    ]);
    return { data: rows.map((u) => this.toPublic(u)), meta: buildPaginationMeta(query.page, query.page_size, total) };
  }

  async getById(id: string) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) throw new ConflictException('A user with this email already exists');

    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await argon2.hash(temporaryPassword);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: dto.full_name,
          email: dto.email,
          phone: dto.phone,
          departmentId: dto.department_id,
          passwordHash,
          mustChangePassword: true,
          ...(dto.position_id ? { positionId: dto.position_id } : {}),
        },
      });
      await tx.userRole.create({ data: { userId: created.id, roleId: dto.role_id } });
      return created;
    });

    return { ...this.toPublic(user), temporary_password: temporaryPassword };
  }

  async update(id: string, dto: UpdateUserDto, actor: { userId: string }) {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException('User not found');
    this.assertEditable(target, actor);

    return this.toPublic(
      await this.repo.update(id, {
        fullName: dto.full_name,
        phone: dto.phone,
        department: dto.department_id ? { connect: { id: dto.department_id } } : undefined,
      }),
    );
  }

  async remove(id: string) {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException('User not found');
    if (target.isSystemOwner) {
      throw new ForbiddenException({ code: 'SYSTEM_OWNER_PROTECTED', message: 'The System Owner cannot be deleted.' });
    }
    await this.repo.softDelete(id);
  }

  async setStatus(id: string, dto: UpdateUserStatusDto) {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException('User not found');
    if (target.isSystemOwner) {
      throw new ForbiddenException({ code: 'SYSTEM_OWNER_PROTECTED', message: 'The System Owner cannot be deactivated.' });
    }
    return this.toPublic(await this.repo.update(id, { status: dto.status }));
  }

  async resetPassword(id: string, actor: { userId: string }) {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException('User not found');
    if (target.isSystemOwner && actor.userId !== target.id) {
      throw new ForbiddenException({ code: 'SYSTEM_OWNER_PROTECTED', message: 'Only the System Owner may reset their own password.' });
    }
    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await argon2.hash(temporaryPassword);
    await this.repo.update(id, { passwordHash, mustChangePassword: true });
    return { temporary_password: temporaryPassword };
  }

  /** Delegates to UserTransfersService so the department/position move and its history row are always recorded atomically. */
  async transfer(id: string, dto: TransferUserDto, actor: { userId: string }) {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException('User not found');
    const updated = await this.userTransfers.transfer(
      id,
      { to_department_id: dto.to_department_id, to_position_id: dto.to_position_id, reason: dto.reason },
      actor.userId,
    );
    return this.toPublic(updated);
  }

  async listTransfers(id: string, query: PaginationQueryDto) {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException('User not found');
    return this.userTransfers.history(id, { page: query.page, page_size: query.page_size });
  }

  private assertEditable(target: { isSystemOwner: boolean; id: string }, actor: { userId: string }) {
    if (target.isSystemOwner && actor.userId !== target.id) {
      throw new ForbiddenException({ code: 'SYSTEM_OWNER_PROTECTED', message: 'The System Owner can only be edited by themself.' });
    }
  }

  private toPublic(user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    departmentId: string;
    positionId: string | null;
    status: string;
    isSystemOwner: boolean;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      full_name: user.fullName,
      email: user.email,
      phone: user.phone,
      department_id: user.departmentId,
      position_id: user.positionId,
      status: user.status,
      is_system_owner: user.isSystemOwner,
      created_at: user.createdAt,
    };
  }
}
