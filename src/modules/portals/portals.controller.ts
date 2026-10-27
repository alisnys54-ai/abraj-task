import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalsService } from './portals.service';
import { SetUserPortalsDto } from './dto/set-user-portals.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Portals')
@ApiBearerAuth('access-token')
@Controller()
export class PortalsController {
  constructor(private readonly portals: PortalsService) {}

  @Get('me/portals')
  @ApiOperation({ summary: 'Portals the caller can open (all four listed; locked ones have granted=false)' })
  mine(@CurrentUser() user: CurrentUserPayload) {
    return this.portals.forCaller(user.userId, user.isSystemOwner);
  }

  @RequirePermission(PermissionModule.PORTALS, PermissionAction.VIEW)
  @Get('users/:id/portals')
  forUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.portals.forUser(id);
  }

  @RequirePermission(PermissionModule.PORTALS, PermissionAction.MANAGE)
  @Put('users/:id/portals')
  @ApiOperation({ summary: 'Replace the set of portals a user may open' })
  set(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetUserPortalsDto, @CurrentUser('userId') actorId: string) {
    return this.portals.setForUser(id, dto.portals, actorId);
  }
}
