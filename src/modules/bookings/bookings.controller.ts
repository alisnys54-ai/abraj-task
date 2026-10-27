import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ResidentialProject } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CancelBookingDto, ConfirmBookingDto, CreateBookingDto, PayInstallmentDto, QueryBookingsDto, QueryInstallmentsDto } from './dto/booking.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequirePortal } from '../../common/decorators/require-portal.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import type { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('Residential projects — bookings & installments')
@ApiBearerAuth('access-token')
@RequirePortal({ fromParam: 'project_key' })
@Controller('projects/:project_key')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @RequirePermission(PermissionModule.RE_BOOKINGS, PermissionAction.VIEW)
  @Get('bookings')
  list(@CurrentProject() project: ResidentialProject, @Query() query: QueryBookingsDto, @CurrentActor() actor: ScopedActor) {
    return this.bookings.list(project, query, actor);
  }

  @RequirePermission(PermissionModule.RE_BOOKINGS, PermissionAction.VIEW)
  @Get('bookings/:id')
  get(@CurrentProject() project: ResidentialProject, @Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: ScopedActor) {
    return this.bookings.get(project, id, actor);
  }

  @RequirePermission(PermissionModule.RE_BOOKINGS, PermissionAction.CREATE)
  @Post('bookings')
  create(@CurrentProject() project: ResidentialProject, @Body() dto: CreateBookingDto, @CurrentActor() actor: ScopedActor) {
    return this.bookings.create(project, dto, actor);
  }

  @RequirePermission(PermissionModule.RE_BOOKINGS, PermissionAction.EDIT)
  @Patch('bookings/:id/confirm')
  confirm(@CurrentProject() project: ResidentialProject, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmBookingDto, @CurrentActor() actor: ScopedActor) {
    return this.bookings.confirm(project, id, dto, actor);
  }

  @RequirePermission(PermissionModule.RE_BOOKINGS, PermissionAction.EDIT)
  @Patch('bookings/:id/cancel')
  cancel(@CurrentProject() project: ResidentialProject, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingDto, @CurrentActor() actor: ScopedActor) {
    return this.bookings.cancel(project, id, dto, actor);
  }

  @RequirePermission(PermissionModule.RE_INSTALLMENTS, PermissionAction.VIEW)
  @Get('installments')
  installments(@CurrentProject() project: ResidentialProject, @Query() query: QueryInstallmentsDto, @CurrentActor() actor: ScopedActor) {
    return this.bookings.installments(project, query, actor);
  }

  @RequirePermission(PermissionModule.RE_INSTALLMENTS, PermissionAction.EDIT)
  @Post('installments/:id/pay')
  pay(@CurrentProject() project: ResidentialProject, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayInstallmentDto, @CurrentActor() actor: ScopedActor) {
    return this.bookings.pay(project, id, dto, actor);
  }
}
