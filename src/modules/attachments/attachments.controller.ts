import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Base64UploadDto } from './dto/base64-upload.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionAction, PermissionModule } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TasksService } from '../tasks/tasks.service';
import { BrowseAttachmentsDto } from './dto/browse-attachments.dto';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import { ScopedActor } from '../../common/utils/scope.util';

@ApiTags('Attachments')
@ApiBearerAuth('access-token')
@Controller()
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly tasksService: TasksService,
  ) {}

  @RequirePermission(PermissionModule.ATTACHMENTS, PermissionAction.VIEW)
  @Get('attachments')
  browse(@Query() query: BrowseAttachmentsDto, @CurrentActor() actor: ScopedActor) {
    return this.attachmentsService.browse(query, actor);
  }

  @RequirePermission(PermissionModule.ATTACHMENTS, PermissionAction.VIEW)
  @Get('tasks/:id/attachments')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.list(id);
  }

  @RequirePermission(PermissionModule.ATTACHMENTS, PermissionAction.UPLOAD)
  @Post('tasks/:id/attachments/upload-url')
  requestUploadUrl(@Body() dto: RequestUploadUrlDto) {
    return this.attachmentsService.requestUploadUrl(dto);
  }

  @RequirePermission(PermissionModule.ATTACHMENTS, PermissionAction.UPLOAD)
  @Post('tasks/:id/attachments')
  async confirmUpload(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmUploadDto, @CurrentUser('userId') uploaderId: string) {
    const notifyUserIds = await this.tasksService.getInterestedUserIds(id);
    return this.attachmentsService.confirmUpload(id, dto, uploaderId, notifyUserIds);
  }

  @RequirePermission(PermissionModule.ATTACHMENTS, PermissionAction.UPLOAD)
  @Post('tasks/:id/attachments/base64')
  async uploadBase64(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Base64UploadDto, @CurrentUser('userId') uploaderId: string) {
    const notifyUserIds = await this.tasksService.getInterestedUserIds(id);
    return this.attachmentsService.uploadBase64(id, dto, uploaderId, notifyUserIds);
  }

  /**
   * Serves stored bytes so <img src> and plain links work without an
   * Authorization header. Access is by capability: the attachment id is a
   * random UUIDv4 only ever returned to users who can see the task.
   */
  @Public()
  @Get('attachments/:attachmentId/file')
  async file(@Param('attachmentId', ParseUUIDPipe) attachmentId: string, @Query('download') download: string | undefined, @Res() res: Response) {
    const a = await this.attachmentsService.getContent(attachmentId);
    res.setHeader('Content-Type', a.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.fileName)}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(a.content!));
  }

  @RequirePermission(PermissionModule.ATTACHMENTS, PermissionAction.VIEW)
  @Get('attachments/:attachmentId/download-url')
  getDownloadUrl(@Param('attachmentId', ParseUUIDPipe) attachmentId: string) {
    return this.attachmentsService.getDownloadUrl(attachmentId);
  }

  @RequirePermission(PermissionModule.ATTACHMENTS, PermissionAction.DELETE)
  @Delete('attachments/:attachmentId')
  remove(@Param('attachmentId', ParseUUIDPipe) attachmentId: string, @CurrentUser('userId') actorId: string) {
    return this.attachmentsService.remove(attachmentId, actorId);
  }
}
