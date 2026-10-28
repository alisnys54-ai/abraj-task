import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserTransfersRepository } from './user-transfers.repository';
import { DepartmentsService } from '../departments/departments.service';

export interface TransferInput {
  to_department_id: string;
  to_position_id?: string;
  reason?: string;
}

/**
 * Owns the department/position transfer workflow: validates the target, then
 * records the history row and moves the user in a single transaction — the
 * two must never be allowed to diverge.
 */
@Injectable()
export class UserTransfersService {
  constructor(
    private readonly repo: UserTransfersRepository,
    private readonly prisma: PrismaService,
    private readonly departments: DepartmentsService,
  ) {}

  async transfer(userId: string, dto: TransferInput, actorId: string) {
    await this.departments.assertActiveDepartment(dto.to_department_id);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findFirst({ where: { id: userId, deletedAt: null } });
      if (!current) throw new NotFoundException('User not found');

      if (dto.to_position_id) {
        const position = await tx.position.findUnique({ where: { id: dto.to_position_id } });
        if (!position || position.isArchived) throw new NotFoundException('Target position not found or archived');
      }

      await tx.userTransfer.create({
        data: {
          userId,
          fromDepartmentId: current.departmentId,
          toDepartmentId: dto.to_department_id,
          fromPositionId: current.positionId,
          toPositionId: dto.to_position_id ?? current.positionId,
          reason: dto.reason,
          transferredBy: actorId,
        },
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          department: { connect: { id: dto.to_department_id } },
          ...(dto.to_position_id !== undefined
            ? { position: dto.to_position_id ? { connect: { id: dto.to_position_id } } : { disconnect: true } }
            : {}),
        },
      });
    });
  }

  async history(userId: string, query: { page: number; page_size: number }) {
    const skip = (query.page - 1) * query.page_size;
    const [rows, total] = await Promise.all([
      this.repo.findByUser(userId, skip, query.page_size),
      this.repo.countByUser(userId),
    ]);
    return {
      data: rows.map((t) => ({
        id: t.id,
        from_department: t.fromDepartment ? { id: t.fromDepartment.id, name: t.fromDepartment.name } : null,
        to_department: { id: t.toDepartment.id, name: t.toDepartment.name },
        from_position: t.fromPosition ? { id: t.fromPosition.id, title: t.fromPosition.title } : null,
        to_position: t.toPosition ? { id: t.toPosition.id, title: t.toPosition.title } : null,
        reason: t.reason,
        transferred_at: t.transferredAt,
      })),
      meta: { page: query.page, page_size: query.page_size, total, total_pages: Math.max(1, Math.ceil(total / query.page_size)) },
    };
  }
}
