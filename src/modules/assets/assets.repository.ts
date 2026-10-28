import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const EQUIPMENT_INCLUDE = { plant: { select: { id: true, name: true } }, site: { select: { id: true, code: true, name: true } } } satisfies Prisma.EquipmentInclude;

@Injectable()
export class AssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listPlants() {
    return this.prisma.plant.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { equipment: true } } } });
  }
  findPlantByName(name: string) {
    return this.prisma.plant.findUnique({ where: { name } });
  }
  createPlant(data: Prisma.PlantCreateInput) {
    return this.prisma.plant.create({ data, include: { _count: { select: { equipment: true } } } });
  }
  findEquipment(args: Prisma.EquipmentFindManyArgs) {
    return this.prisma.equipment.findMany({ ...args, include: EQUIPMENT_INCLUDE });
  }
  countEquipment(where: Prisma.EquipmentWhereInput) {
    return this.prisma.equipment.count({ where });
  }
  equipmentByStatus() {
    return this.prisma.equipment.groupBy({ by: ['status'], _count: { _all: true } });
  }
  findEquipmentById(id: string) {
    return this.prisma.equipment.findUnique({ where: { id }, include: EQUIPMENT_INCLUDE });
  }
  findEquipmentByCode(code: string) {
    return this.prisma.equipment.findUnique({ where: { code } });
  }
  createEquipment(data: Prisma.EquipmentUncheckedCreateInput) {
    return this.prisma.equipment.create({ data, include: EQUIPMENT_INCLUDE });
  }
  updateEquipment(id: string, data: Prisma.EquipmentUncheckedUpdateInput) {
    return this.prisma.equipment.update({ where: { id }, data, include: EQUIPMENT_INCLUDE });
  }
}
