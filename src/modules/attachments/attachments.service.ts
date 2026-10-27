import { BadRequestException, Inject, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import * as path from 'path';
import { AttachmentsRepository } from './attachments.repository';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { Base64UploadDto } from './dto/base64-upload.dto';
import { BrowseAttachmentsDto } from './dto/browse-attachments.dto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopedActor, actorDepartmentId } from '../../common/utils/scope.util';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';

const MAX_BYTES = 25 * 1024 * 1024;
/** Images (incl. phone camera HEIC), PDFs, office documents, drawings, CSV/text. */
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf|application\/(msword|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-(excel|powerpoint))|text\/(plain|csv)|application\/(acad|dxf|x-dwg|octet-stream))$/;

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly repo: AttachmentsRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly activityLog: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Files page: company scope sees everything, department scope its department's tasks, own scope what they uploaded or are assigned. */
  async browse(query: BrowseAttachmentsDto, actor: ScopedActor) {
    const and: Prisma.AttachmentWhereInput[] = [{ deletedAt: null, supersededBy: { none: {} }, task: { deletedAt: null } }];
    if (actor.scope === 'department') and.push({ task: { departmentId: (await actorDepartmentId(this.prisma, actor.userId)) ?? '00000000-0000-0000-0000-000000000000' } });
    if (actor.scope === 'own') and.push({ OR: [{ uploaderId: actor.userId }, { task: { assigneeId: actor.userId } }, { task: { createdBy: actor.userId } }] });
    if (query.user_id) and.push({ uploaderId: query.user_id });
    if (query.search) and.push({ OR: [{ fileName: { contains: query.search, mode: 'insensitive' } }, { task: { title: { contains: query.search, mode: 'insensitive' } } }] });
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await this.repo.browse({ AND: and }, skip, take);
    return {
      data: rows.map((a) => ({ ...this.toPublic(a), uploader: { id: a.uploader.id, full_name: a.uploader.fullName }, task: { id: a.task.id, code: a.task.code, title: a.task.title } })),
      meta: buildPaginationMeta(query.page, query.page_size, total),
    };
  }

  async list(taskId: string) {
    const rows = await this.repo.findByTask(taskId);
    return rows.map((a) => this.toPublic(a));
  }

  requestUploadUrl(dto: RequestUploadUrlDto) {
    return this.storage.getUploadUrl(dto.file_name, dto.mime_type);
  }

  async confirmUpload(taskId: string, dto: ConfirmUploadDto, uploaderId: string, notifyUserIds: string[]) {
    let versionNumber = 1;
    if (dto.supersedes_id) {
      const previous = await this.repo.findById(dto.supersedes_id);
      if (!previous) throw new NotFoundException('Attachment being replaced was not found');
      versionNumber = previous.versionNumber + 1;
    }

    const created = await this.repo.create({
      task: { connect: { id: taskId } },
      uploader: { connect: { id: uploaderId } },
      fileName: path.basename(dto.file_name), // strip any path segments a client might smuggle into the display name
      fileUrl: dto.object_key,
      fileSizeBytes: dto.file_size_bytes,
      mimeType: dto.mime_type,
      versionNumber,
      kind: dto.kind ?? (dto.mime_type?.startsWith('image/') ? 'photo' : 'document'),
      note: dto.note,
      ...(dto.supersedes_id ? { supersedes: { connect: { id: dto.supersedes_id } } } : {}),
    });

    await this.activityLog.record({ taskId, actorId: uploaderId, action: dto.kind === 'proof' ? 'proof_added' : 'attachment_added', newValue: dto.file_name });
    await this.notifications.dispatch({
      userIds: notifyUserIds.filter((u) => u !== uploaderId),
      taskId,
      eventType: 'attachment_added',
      message: `New attachment: ${dto.file_name}`,
    });

    return this.toPublic(created);
  }

  /** Stores the file in Postgres — the path the web app uses (camera, scanner, file picker). */
  async uploadBase64(taskId: string, dto: Base64UploadDto, uploaderId: string, notifyUserIds: string[]) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dto.data_base64);
    const mimeType = (dto.mime_type ?? match?.[1] ?? 'application/octet-stream').toLowerCase();
    if (!ALLOWED_MIME.test(mimeType)) throw new BadRequestException({ code: 'FILE_TYPE_NOT_ALLOWED', message: `Files of type ${mimeType} are not accepted` });
    const bytes = Buffer.from(match ? match[3] : dto.data_base64, 'base64');
    if (bytes.length === 0) throw new BadRequestException('The file is empty');
    if (bytes.length > MAX_BYTES) throw new PayloadTooLargeException('Files are limited to 25 MB');
    const kind = dto.kind ?? (mimeType.startsWith('image/') ? 'photo' : 'document');

    const created = await this.repo.create({
      task: { connect: { id: taskId } },
      uploader: { connect: { id: uploaderId } },
      fileName: path.basename(dto.file_name),
      fileUrl: 'db',
      fileSizeBytes: bytes.length,
      mimeType,
      kind,
      note: dto.note,
      content: bytes,
    });
    await this.activityLog.record({ taskId, actorId: uploaderId, action: kind === 'proof' ? 'proof_added' : 'attachment_added', newValue: created.fileName });
    await this.notifications.dispatch({ userIds: notifyUserIds.filter((u) => u !== uploaderId), taskId, eventType: 'attachment_added', message: kind === 'proof' ? `إثبات إنجاز جديد: ${created.fileName}` : `New attachment: ${created.fileName}` });
    return this.toPublic(created);
  }

  async getContent(id: string) {
    const a = await this.repo.findContent(id);
    if (!a || !a.content) throw new NotFoundException('File not found');
    return a;
  }

  async getDownloadUrl(id: string) {
    const attachment = await this.repo.findById(id);
    if (!attachment) throw new NotFoundException('Attachment not found');
    return this.storage.getDownloadUrl(attachment.fileUrl);
  }

  async remove(id: string, actorId: string) {
    const attachment = await this.repo.findById(id);
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.repo.softDelete(id);
    await this.activityLog.record({ taskId: attachment.taskId, actorId, action: 'attachment_removed', oldValue: attachment.fileName });
  }

  private toPublic(a: { id: string; fileName: string; versionNumber: number; createdAt: Date; uploaderId: string; kind: string; note: string | null; mimeType: string | null; fileSizeBytes: bigint | null }) {
    return {
      id: a.id, file_name: a.fileName, version_number: a.versionNumber, uploader_id: a.uploaderId, created_at: a.createdAt,
      kind: a.kind, note: a.note, mime_type: a.mimeType, file_size_bytes: a.fileSizeBytes === null ? null : Number(a.fileSizeBytes),
    };
  }
}
