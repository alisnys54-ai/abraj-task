import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SavedFiltersService } from './saved-filters.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Saved Filters')
@ApiBearerAuth('access-token')
@Controller('saved-filters')
export class SavedFiltersController {
  constructor(private readonly savedFiltersService: SavedFiltersService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.savedFiltersService.list(userId);
  }

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateSavedFilterDto) {
    return this.savedFiltersService.create(userId, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') userId: string, @Body() dto: UpdateSavedFilterDto) {
    return this.savedFiltersService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') userId: string) {
    return this.savedFiltersService.remove(id, userId);
  }
}
