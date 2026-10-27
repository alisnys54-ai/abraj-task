import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const ATTACHMENT_META = {
  id: true, taskId: true, uploaderId: true, fileName: true, fileUrl: true, fileSizeBytes: true, mimeType: true,
  versionNumber: true, kind: true, note: true, supersedesId: true, deletedAt: true, createdAt: true,
} satisfies Prisma.AttachmentSelect;

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTask(taskId: string) {
    return this.prisma.attachment.findMany({
      where: { taskId, deletedAt: null, supersededBy: { none: {} } },
      orderBy: { createdAt: 'desc' },
      select: ATTACHMENT_META,
    });
  }

  /** Metadata only — never pulls the file bytes. */
  findById(id: string) {
    return this.prisma.attachment.findFirst({ where: { id, deletedAt: null }, select: ATTACHMENT_META });
  }

  /** Bytes + the headers needed to serve them. */
  findContent(id: string) {
    return this.prisma.attachment.findFirst({ where: { id, deletedAt: null }, select: { fileName: true, mimeType: true, content: true, fileUrl: true } });
  }

  /** Cross-task browse for the files page — metadata plus the task it belongs to. */
  browse(where: Prisma.AttachmentWhereInput, skip: number, take: number) {
    return Promise.all([
      this.prisma.attachment.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        select: { ...ATTACHMENT_META, uploader: { select: { id: true, fullName: true } }, task: { select: { id: true, code: true, title: true } } },
      }),
      this.prisma.attachment.count({ where }),
    ]);
  }

  create(data: Prisma.AttachmentCreateInput) {
    return this.prisma.attachment.create({ data, select: ATTACHMENT_META });
  }

  softDelete(id: string) {
    return this.prisma.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
