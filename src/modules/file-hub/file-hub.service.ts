import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FileHubRepository } from './file-hub.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryFileHubDto } from './dto/query-file-hub.dto';
import { buildPaginationMeta, paginationSkipTake } from '../../common/utils/pagination.util';
import { ScopedActor, actorDepartmentId } from '../../common/utils/scope.util';

/**
 * Every task attachment, organised by the task's department. A company-wide
 * viewer (General Manager) sees all departments; a department manager is
 * locked to their own department server-side, whatever they ask for.
 */
@Injectable()
export class FileHubService {
  constructor(
    private readonly repo: FileHubRepository,
    private readonly prisma: PrismaService,
  ) {}

  private async departmentLock(actor: ScopedActor, requested?: string): Promise<string | undefined> {
    if (actor.scope === 'all') return requested;
    if (actor.scope === 'department') return actorDepartmentId(this.prisma, actor.userId);
    throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'The file hub is for managers' });
  }

  async list(query: QueryFileHubDto, actor: ScopedActor) {
    const departmentId = await this.departmentLock(actor, query.department_id);
    const and: Prisma.AttachmentWhereInput[] = [{ deletedAt: null, task: { deletedAt: null, ...(departmentId ? { departmentId } : {}) } }];
    if (query.kind) and.push({ kind: query.kind });
    if (query.search) {
      and.push({ OR: [{ fileName: { contains: query.search, mode: 'insensitive' } }, { task: { title: { contains: query.search, mode: 'insensitive' } } }, { task: { code: { contains: query.search, mode: 'insensitive' } } }, { uploader: { fullName: { contains: query.search, mode: 'insensitive' } } }] });
    }
    const where = { AND: and };
    const { skip, take } = paginationSkipTake(query.page, query.page_size);
    const [rows, total] = await Promise.all([this.repo.find({ where, skip, take, orderBy: [{ task: { department: { name: 'asc' } } }, { task: { code: 'asc' } }, { createdAt: 'desc' }] }), this.repo.count(where)]);
    return {
      data: rows.map((a) => ({
        id: a.id, file_name: a.fileName, kind: a.kind, note: a.note, mime_type: a.mimeType, file_size_bytes: a.fileSizeBytes === null ? null : Number(a.fileSizeBytes),
        uploader: { id: a.uploader.id, full_name: a.uploader.fullName }, created_at: a.createdAt,
        task: { id: a.task.id, code: a.task.code, title: a.task.title, status: a.task.status.name },
        department: a.task.department,
      })),
      meta: buildPaginationMeta(query.page, query.page_size, total),
      locked_department_id: actor.scope === 'department' ? departmentId : null,
    };
  }

  /** Counts per department and kind — the chips and KPI tiles above the list. */
  async summary(actor: ScopedActor) {
    const departmentId = await this.departmentLock(actor);
    const rows = await this.repo.countByDepartmentAndKind(departmentId ?? null);
    const byDept = new Map<string, { department_id: string; department: string; document: number; photo: number; proof: number; total: number }>();
    for (const r of rows) {
      const d = byDept.get(r.department_id) ?? { department_id: r.department_id, department: r.department, document: 0, photo: 0, proof: 0, total: 0 };
      d[r.kind as 'document' | 'photo' | 'proof'] = Number(r.n);
      d.total += Number(r.n);
      byDept.set(r.department_id, d);
    }
    const departments = [...byDept.values()];
    return {
      departments,
      totals: departments.reduce((a, d) => ({ document: a.document + d.document, photo: a.photo + d.photo, proof: a.proof + d.proof, total: a.total + d.total }), { document: 0, photo: 0, proof: 0, total: 0 }),
    };
  }
}
