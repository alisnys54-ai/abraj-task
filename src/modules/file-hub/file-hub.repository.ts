import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FileHubRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(args: Prisma.AttachmentFindManyArgs) {
    return this.prisma.attachment.findMany({
      ...args,
      select: {
        id: true, fileName: true, kind: true, note: true, mimeType: true, fileSizeBytes: true, createdAt: true,
        uploader: { select: { id: true, fullName: true } },
        task: { select: { id: true, code: true, title: true, status: { select: { name: true } }, department: { select: { id: true, name: true } } } },
      },
    });
  }

  count(where: Prisma.AttachmentWhereInput) {
    return this.prisma.attachment.count({ where });
  }

  countByDepartmentAndKind(departmentId: string | null) {
    return this.prisma.$queryRaw<{ department_id: string; department: string; kind: string; n: bigint }[]>`
      SELECT d.id AS department_id, d.name AS department, a.kind::text AS kind, COUNT(*) AS n
      FROM attachments a JOIN tasks t ON t.id = a.task_id JOIN departments d ON d.id = t.department_id
      WHERE a.deleted_at IS NULL AND t.deleted_at IS NULL
        AND (${departmentId}::uuid IS NULL OR d.id = ${departmentId}::uuid)
      GROUP BY d.id, d.name, a.kind ORDER BY d.name`;
  }
}
