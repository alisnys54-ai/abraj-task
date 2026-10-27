import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, QueryEmployeesDto, UpdateEmployeeDto } from './dto/employee.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequirePortal } from '../../common/decorators/require-portal.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('HR — Employees')
@ApiBearerAuth('access-token')
@RequirePortal('company')
@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @RequirePermission(PermissionModule.EMPLOYEES, PermissionAction.VIEW)
  @Get()
  list(@Query() query: QueryEmployeesDto, @CurrentActor() actor: ScopedActor) {
    return this.employees.list(query, actor);
  }

  @RequirePermission(PermissionModule.EMPLOYEES, PermissionAction.VIEW)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: ScopedActor) {
    return this.employees.getById(id, actor);
  }

  @RequirePermission(PermissionModule.EMPLOYEES, PermissionAction.CREATE)
  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentActor() actor: ScopedActor) {
    return this.employees.create(dto, actor);
  }

  @RequirePermission(PermissionModule.EMPLOYEES, PermissionAction.EDIT)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto, @CurrentActor() actor: ScopedActor) {
    return this.employees.update(id, dto, actor);
  }
}
