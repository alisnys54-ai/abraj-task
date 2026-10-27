import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

/** Read-only lookups for the two fixed catalogs (9 statuses, 4 priorities) — any authenticated user needs these to build a task form or a status-change control, so no @RequirePermission beyond being logged in. */
@ApiTags('Task Lookups')
@ApiBearerAuth('access-token')
@Controller()
export class TaskLookupsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('task-statuses')
  @ApiOperation({ summary: 'All 9 task statuses, in workflow order' })
  async statuses() {
    const rows = await this.prisma.taskStatus.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((s) => ({ id: s.id, name: s.name, sort_order: s.sortOrder }));
  }

  @Get('task-priorities')
  @ApiOperation({ summary: 'All 4 task priorities, in severity order' })
  async priorities() {
    const rows = await this.prisma.taskPriority.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((p) => ({ id: p.id, name: p.name, sort_order: p.sortOrder }));
  }
}
