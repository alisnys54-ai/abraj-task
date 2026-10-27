import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto, DecideLeaveDto, QueryLeavesDto } from './dto/leave.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequirePortal } from '../../common/decorators/require-portal.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('HR — Leaves')
@ApiBearerAuth('access-token')
@RequirePortal('company')
@Controller('hr/leaves')
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @RequirePermission(PermissionModule.LEAVES, PermissionAction.VIEW)
  @Get()
  list(@Query() query: QueryLeavesDto, @CurrentActor() actor: ScopedActor) {
    return this.leaves.list(query, actor);
  }

  @RequirePermission(PermissionModule.LEAVES, PermissionAction.CREATE)
  @Post()
  create(@Body() dto: CreateLeaveDto, @CurrentActor() actor: ScopedActor) {
    return this.leaves.create(dto, actor);
  }

  @RequirePermission(PermissionModule.LEAVES, PermissionAction.APPROVE)
  @Patch(':id/decision')
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveDto, @CurrentActor() actor: ScopedActor) {
    return this.leaves.decide(id, dto, actor);
  }

  @RequirePermission(PermissionModule.LEAVES, PermissionAction.VIEW)
  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: ScopedActor) {
    return this.leaves.cancel(id, actor);
  }
}
