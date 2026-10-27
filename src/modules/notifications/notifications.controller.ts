import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser('userId') userId: string, @Query() query: QueryNotificationsDto) {
    return this.notificationsService.list(userId, query);
  }

  @Patch(':id/read')
  setRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') userId: string, @Body('is_read') isRead: boolean) {
    return this.notificationsService.setRead(id, userId, isRead ?? true);
  }

  @Post('mark-all-read')
  markAllRead(@CurrentUser('userId') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') userId: string) {
    return this.notificationsService.remove(id, userId);
  }
}
