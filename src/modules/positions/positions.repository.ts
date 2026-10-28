import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PositionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(args: Prisma.PositionFindManyArgs) {
    return this.prisma.position.findMany(args);
  }

  count(where: Prisma.PositionWhereInput) {
    return this.prisma.position.count({ where });
  }

  findById(id: string) {
    return this.prisma.position.findUnique({ where: { id } });
  }

  findByTitleInDepartment(title: string, departmentId: string | null) {
    return this.prisma.position.findFirst({ where: { title, departmentId } });
  }

  create(data: Prisma.PositionCreateInput) {
    return this.prisma.position.create({ data });
  }

  update(id: string, data: Prisma.PositionUpdateInput) {
    return this.prisma.position.update({ where: { id }, data });
  }
}
