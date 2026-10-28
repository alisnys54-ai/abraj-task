import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileHubService } from './file-hub.service';
import { QueryFileHubDto } from './dto/query-file-hub.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('File hub')
@ApiBearerAuth('access-token')
@Controller('file-hub')
export class FileHubController {
  constructor(private readonly hub: FileHubService) {}

  @RequirePermission(PermissionModule.FILES, PermissionAction.VIEW)
  @Get()
  @ApiOperation({ summary: 'Task files by department — GM sees all, a department manager only their own' })
  list(@Query() query: QueryFileHubDto, @CurrentActor() actor: ScopedActor) {
    return this.hub.list(query, actor);
  }

  @RequirePermission(PermissionModule.FILES, PermissionAction.VIEW)
  @Get('summary')
  summary(@CurrentActor() actor: ScopedActor) {
    return this.hub.summary(actor);
  }
}
