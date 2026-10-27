import { Module } from '@nestjs/common';
import { SavedFiltersController } from './saved-filters.controller';
import { SavedFiltersService } from './saved-filters.service';
import { SavedFiltersRepository } from './saved-filters.repository';

@Module({
  controllers: [SavedFiltersController],
  providers: [SavedFiltersService, SavedFiltersRepository],
})
export class SavedFiltersModule {}
