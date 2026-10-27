import { Injectable, NotFoundException } from '@nestjs/common';
import { SavedFiltersRepository } from './saved-filters.repository';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';

@Injectable()
export class SavedFiltersService {
  constructor(private readonly repo: SavedFiltersRepository) {}

  async list(userId: string) {
    const rows = await this.repo.findByUser(userId);
    return rows.map((f) => this.toPublic(f));
  }

  async create(userId: string, dto: CreateSavedFilterDto) {
    const created = await this.repo.create({ user: { connect: { id: userId } }, name: dto.name, viewType: dto.view_type, filters: dto.filters as object });
    return this.toPublic(created);
  }

  async update(id: string, userId: string, dto: UpdateSavedFilterDto) {
    const owned = await this.repo.findOwned(id, userId);
    if (!owned) throw new NotFoundException('Saved filter not found');
    return this.toPublic(await this.repo.update(id, { name: dto.name, filters: dto.filters as object }));
  }

  async remove(id: string, userId: string) {
    const owned = await this.repo.findOwned(id, userId);
    if (!owned) throw new NotFoundException('Saved filter not found');
    await this.repo.softDelete(id);
  }

  private toPublic(f: { id: string; name: string; viewType: string; filters: unknown; createdAt: Date }) {
    return { id: f.id, name: f.name, view_type: f.viewType, filters: f.filters, created_at: f.createdAt };
  }
}
