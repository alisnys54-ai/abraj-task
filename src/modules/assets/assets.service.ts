import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetsRepository } from './assets.repository';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateEquipmentDto, CreatePlantDto, QueryEquipmentDto, UpdateEquipmentDto } from './dto/assets.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';

type EquipmentRow = NonNullable<Awaited<ReturnType<AssetsRepository['findEquipmentById']>>>;

@Injectable()
export class AssetsService {
  constructor(
    private readonly repo: AssetsRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  async plants() {
    return (await this.repo.listPlants()).map((p) => ({ id: p.id, name: p.name, location: p.location, kind: p.kind, capacity: p.capacity, is_active: p.isActive, equipment_count: p._count.equipment }));
  }

  async createPlant(dto: CreatePlantDto, actorId: string) {
    if (await this.repo.findPlantByName(dto.name)) throw new ConflictException('A plant with this name already exists');
    const p = await this.repo.createPlant({ name: dto.name, location: dto.location, kind: dto.kind, capacity: dto.capacity });
    await this.activityLog.record({ actorId, action: 'plant_created', newValue: p.name });
    return { id: p.id, name: p.name, location: p.location, kind: p.kind, capacity: p.capacity, is_active: p.isActive, equipment_count: 0 };
  }

  async equipment(query: QueryEquipmentDto) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.plant_id ? { plantId: query.plant_id } : {}),
      ...(query.search ? { OR: [{ code: { contains: query.search, mode: 'insensitive' as const } }, { model: { contains: query.search, mode: 'insensitive' as const } }] } : {}),
    };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total, byStatus] = await Promise.all([
      this.repo.findEquipment({ where, skip, take, orderBy: { code: 'asc' } }),
      this.repo.countEquipment(where),
      this.repo.equipmentByStatus(),
    ]);
    return {
      data: rows.map((e) => this.toPublic(e)),
      meta: buildPaginationMeta(query.page, query.page_size, total),
      summary: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
    };
  }

  async createEquipment(dto: CreateEquipmentDto, actorId: string) {
    if (await this.repo.findEquipmentByCode(dto.code)) throw new ConflictException({ code: 'EQUIPMENT_CODE_TAKEN', message: `${dto.code} already exists` });
    const e = await this.repo.createEquipment({ code: dto.code, category: dto.category, model: dto.model, plantId: dto.plant_id, siteId: dto.site_id, status: dto.status, notes: dto.notes });
    await this.activityLog.record({ actorId, action: 'equipment_created', newValue: e.code });
    return this.toPublic(e);
  }

  async updateEquipment(id: string, dto: UpdateEquipmentDto, actorId: string) {
    const current = await this.repo.findEquipmentById(id);
    if (!current) throw new NotFoundException('Equipment not found');
    const e = await this.repo.updateEquipment(id, { status: dto.status, plantId: dto.plant_id, siteId: dto.site_id, notes: dto.notes });
    if (dto.status && dto.status !== current.status) {
      await this.activityLog.record({ actorId, action: 'equipment_status_changed', fieldName: 'status', oldValue: current.status, newValue: dto.status, details: { code: e.code } });
    }
    return this.toPublic(e);
  }

  private toPublic(e: EquipmentRow) {
    return { id: e.id, code: e.code, category: e.category, model: e.model, plant: e.plant, site: e.site, status: e.status, notes: e.notes, updated_at: e.updatedAt };
  }
}
