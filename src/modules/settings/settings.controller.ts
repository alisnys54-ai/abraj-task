import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateCompanySettingDto } from './dto/update-company-setting.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { SystemOwnerOnly } from '../../common/decorators/system-owner-only.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@Controller('settings/company')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @RequirePermission(PermissionModule.SETTINGS, PermissionAction.VIEW)
  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @RequirePermission(PermissionModule.SETTINGS, PermissionAction.MANAGE)
  @SystemOwnerOnly()
  @Patch()
  update(@Body() dto: UpdateCompanySettingDto, @CurrentUser('userId') actorId: string) {
    return this.settingsService.update(dto, actorId);
  }
}
