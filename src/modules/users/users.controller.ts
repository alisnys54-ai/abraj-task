import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { SystemOwnerOnly } from '../../common/decorators/system-owner-only.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { MeService } from '../me/me.service';
import { AllowWhenPasswordChangeRequired } from '../../common/decorators/allow-when-password-change-required.decorator';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly me: MeService,
  ) {}

  /** Alias of GET /me — the web app reads the session profile from here. Declared before ':id' so it wins the route match. */
  @AllowWhenPasswordChangeRequired()
  @Get('me')
  getMe(@CurrentUser('userId') userId: string) {
    return this.me.getProfile(userId);
  }

  @RequirePermission(PermissionModule.USERS, PermissionAction.VIEW)
  @Get()
  @ApiOperation({ summary: 'List users' })
  list(@Query() query: QueryUsersDto) {
    return this.usersService.list(query);
  }

  @RequirePermission(PermissionModule.USERS, PermissionAction.VIEW)
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getById(id);
  }

  @RequirePermission(PermissionModule.USERS, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: 'Create a user — returns a system-generated temporary password once' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @RequirePermission(PermissionModule.USERS, PermissionAction.EDIT)
  @Patch(':id')
  @ApiOperation({ summary: "Update a user's profile fields" })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: CurrentUserPayload) {
    return this.usersService.update(id, dto, actor);
  }

  @RequirePermission(PermissionModule.USERS, PermissionAction.DELETE)
  @SystemOwnerOnly()
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a user (System Owner only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @RequirePermission(PermissionModule.USERS, PermissionAction.MANAGE)
  @SystemOwnerOnly()
  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a user (System Owner only)' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.setStatus(id, dto);
  }

  @RequirePermission(PermissionModule.USERS, PermissionAction.MANAGE)
  @SystemOwnerOnly()
  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Admin-triggered password reset (System Owner only)' })
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.usersService.resetPassword(id, actor);
  }

  @RequirePermission(PermissionModule.USERS, PermissionAction.MANAGE)
  @SystemOwnerOnly()
  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transfer a user to a different department/position — recorded in transfer history (System Owner only)' })
  transfer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferUserDto, @CurrentUser() actor: CurrentUserPayload) {
    return this.usersService.transfer(id, dto, actor);
  }

  @RequirePermission(PermissionModule.USERS, PermissionAction.VIEW)
  @Get(':id/transfers')
  @ApiOperation({ summary: "A user's department/position transfer history" })
  listTransfers(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQueryDto) {
    return this.usersService.listTransfers(id, query);
  }
}
