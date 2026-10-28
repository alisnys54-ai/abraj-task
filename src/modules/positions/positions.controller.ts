import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PositionsService } from './positions.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { QueryPositionsDto } from './dto/query-positions.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { SystemOwnerOnly } from '../../common/decorators/system-owner-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Positions')
@ApiBearerAuth('access-token')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @RequirePermission(PermissionModule.POSITIONS, PermissionAction.VIEW)
  @Get()
  list(@Query() query: QueryPositionsDto) {
    return this.positionsService.list(query);
  }

  @RequirePermission(PermissionModule.POSITIONS, PermissionAction.VIEW)
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.positionsService.getById(id);
  }

  @RequirePermission(PermissionModule.POSITIONS, PermissionAction.CREATE)
  @SystemOwnerOnly()
  @Post()
  create(@Body() dto: CreatePositionDto, @CurrentUser('userId') actorId: string) {
    return this.positionsService.create(dto, actorId);
  }

  @RequirePermission(PermissionModule.POSITIONS, PermissionAction.EDIT)
  @SystemOwnerOnly()
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePositionDto) {
    return this.positionsService.update(id, dto);
  }

  @RequirePermission(PermissionModule.POSITIONS, PermissionAction.EDIT)
  @SystemOwnerOnly()
  @Patch(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.positionsService.archive(id);
  }

  @RequirePermission(PermissionModule.POSITIONS, PermissionAction.EDIT)
  @SystemOwnerOnly()
  @Patch(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.positionsService.restore(id);
  }
}
