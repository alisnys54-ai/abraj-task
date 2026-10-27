import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/announcement.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequirePortal } from '../../common/decorators/require-portal.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('Announcements')
@ApiBearerAuth('access-token')
@RequirePortal('company')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @RequirePermission(PermissionModule.ANNOUNCEMENTS, PermissionAction.VIEW)
  @Get()
  list(@Query() query: PaginationQueryDto, @CurrentActor() actor: ScopedActor) {
    return this.announcements.list(query, actor);
  }

  @RequirePermission(PermissionModule.ANNOUNCEMENTS, PermissionAction.CREATE)
  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentActor() actor: ScopedActor) {
    return this.announcements.create(dto, actor);
  }

  @RequirePermission(PermissionModule.ANNOUNCEMENTS, PermissionAction.DELETE)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: ScopedActor) {
    return this.announcements.remove(id, actor);
  }
}
