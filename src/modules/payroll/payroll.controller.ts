import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { CreatePeriodDto, QueryEntriesDto, UpdateEntryDto } from './dto/payroll.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequirePortal } from '../../common/decorators/require-portal.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('HR — Payroll')
@ApiBearerAuth('access-token')
@RequirePortal('company')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  @Get('periods')
  periods(@CurrentActor() actor: ScopedActor) {
    return this.payroll.listPeriods(actor);
  }

  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.CREATE)
  @Post('periods')
  create(@Body() dto: CreatePeriodDto, @CurrentActor() actor: ScopedActor) {
    return this.payroll.createPeriod(dto, actor);
  }

  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  @Get('periods/:id')
  period(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: ScopedActor) {
    return this.payroll.getPeriod(id, actor);
  }

  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.VIEW)
  @Get('periods/:id/entries')
  entries(@Param('id', ParseUUIDPipe) id: string, @Query() query: QueryEntriesDto, @CurrentActor() actor: ScopedActor) {
    return this.payroll.entries(id, query, actor);
  }

  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.EDIT)
  @Patch('entries/:id')
  updateEntry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEntryDto, @CurrentActor() actor: ScopedActor) {
    return this.payroll.updateEntry(id, dto, actor);
  }

  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.EDIT)
  @Post('periods/:id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: ScopedActor) {
    return this.payroll.transition(id, 'submit', actor);
  }

  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.APPROVE)
  @Post('periods/:id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: ScopedActor) {
    return this.payroll.transition(id, 'approve', actor);
  }

  @RequirePermission(PermissionModule.PAYROLL, PermissionAction.MANAGE)
  @Post('periods/:id/mark-paid')
  pay(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: ScopedActor) {
    return this.payroll.transition(id, 'pay', actor);
  }
}
