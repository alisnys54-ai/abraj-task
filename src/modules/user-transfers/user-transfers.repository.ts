import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserTransfersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserTransferCreateInput) {
    return this.prisma.userTransfer.create({ data });
  }

  findByUser(userId: string, skip: number, take: number) {
    return this.prisma.userTransfer.findMany({
      where: { userId },
      skip,
      take,
      orderBy: { transferredAt: 'desc' },
      include: { fromDepartment: true, toDepartment: true, fromPosition: true, toPosition: true },
    });
  }

  countByUser(userId: string) {
    return this.prisma.userTransfer.count({ where: { userId } });
  }
}
