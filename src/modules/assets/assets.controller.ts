import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateEquipmentDto, CreatePlantDto, QueryEquipmentDto, UpdateEquipmentDto } from './dto/assets.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequirePortal } from '../../common/decorators/require-portal.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Assets — plants & equipment')
@ApiBearerAuth('access-token')
@RequirePortal('company')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @RequirePermission(PermissionModule.ASSETS, PermissionAction.VIEW)
  @Get('plants')
  plants() {
    return this.assets.plants();
  }

  @RequirePermission(PermissionModule.ASSETS, PermissionAction.CREATE)
  @Post('plants')
  createPlant(@Body() dto: CreatePlantDto, @CurrentUser('userId') actorId: string) {
    return this.assets.createPlant(dto, actorId);
  }

  @RequirePermission(PermissionModule.ASSETS, PermissionAction.VIEW)
  @Get('equipment')
  equipment(@Query() query: QueryEquipmentDto) {
    return this.assets.equipment(query);
  }

  @RequirePermission(PermissionModule.ASSETS, PermissionAction.CREATE)
  @Post('equipment')
  createEquipment(@Body() dto: CreateEquipmentDto, @CurrentUser('userId') actorId: string) {
    return this.assets.createEquipment(dto, actorId);
  }

  @RequirePermission(PermissionModule.ASSETS, PermissionAction.EDIT)
  @Patch('equipment/:id')
  updateEquipment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEquipmentDto, @CurrentUser('userId') actorId: string) {
    return this.assets.updateEquipment(id, dto, actorId);
  }
}
