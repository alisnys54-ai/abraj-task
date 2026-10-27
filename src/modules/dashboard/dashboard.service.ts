import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DashboardRepository, ScopedActor } from './dashboard.repository';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const CACHE_TTL_MS = 30_000; // short — dashboards should feel live, not stale; never the source of truth for a mutation's own read

/**
 * Every method: build a scope+actor-specific cache key, serve from Redis if
 * present, else compute via DashboardRepository and cache the result. Scope
 * is baked into the key itself, so a Manager and an Employee can never read
 * each other's cached numbers even under key collision.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger('DashboardCache');

  constructor(
    private readonly repo: DashboardRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private key(name: string, actor: ScopedActor, query: DashboardQueryDto) {
    return `dashboard:${name}:${actor.scope}:${actor.userId}:${query.date_from ?? ''}:${query.date_to ?? ''}:${query.weeks ?? ''}`;
  }

  /** A Redis outage degrades this to "always compute" rather than a 500 — dashboards get slower, never unavailable. */
  private async cached<T>(name: string, actor: ScopedActor, query: DashboardQueryDto, compute: () => Promise<T>): Promise<T> {
    const key = this.key(name, actor, query);
    try {
      const hit = await this.cache.get<T>(key);
      if (hit !== undefined && hit !== null) return hit;
    } catch (e) {
      this.logger.warn(`Cache read failed for ${key}, falling back to direct compute: ${(e as Error).message}`);
    }
    const value = await compute();
    try {
      await this.cache.set(key, value, CACHE_TTL_MS);
    } catch (e) {
      this.logger.warn(`Cache write failed for ${key}: ${(e as Error).message}`);
    }
    return value;
  }

  kpiSummary(actor: ScopedActor, query: DashboardQueryDto) {
    return this.cached('kpi', actor, query, () => this.repo.kpiSummary(actor, query.date_from ? new Date(query.date_from) : undefined, query.date_to ? new Date(query.date_to) : undefined));
  }

  workloadByUser(actor: ScopedActor, query: DashboardQueryDto) {
    return this.cached('workload', actor, query, () => this.repo.workloadByUser(actor));
  }

  departmentStatistics(actor: ScopedActor, query: DashboardQueryDto) {
    return this.cached('departments', actor, query, () => this.repo.departmentStatistics(actor));
  }

  completionTrend(actor: ScopedActor, query: DashboardQueryDto) {
    return this.cached('trend', actor, query, () => this.repo.completionTrend(actor, query.weeks ?? 12));
  }

  overdueAnalytics(actor: ScopedActor, query: DashboardQueryDto) {
    return this.cached('overdue', actor, query, () => this.repo.overdueAnalytics(actor));
  }

  productivityMetrics(actor: ScopedActor, query: DashboardQueryDto) {
    return this.cached('productivity', actor, query, () => this.repo.productivityMetrics(actor));
  }

  /** Executive/Personal/Team composite views — one call, several sections, still fully cached per-section. */
  async executive(actor: ScopedActor, query: DashboardQueryDto) {
    const [kpis, departments, overdue, trend] = await Promise.all([
      this.kpiSummary(actor, query),
      this.departmentStatistics(actor, query),
      this.overdueAnalytics(actor, query),
      this.completionTrend(actor, query),
    ]);
    return { kpis, departments, overdue, completion_trend: trend };
  }

  async team(actor: ScopedActor, query: DashboardQueryDto) {
    const [kpis, workload, overdue] = await Promise.all([this.kpiSummary(actor, query), this.workloadByUser(actor, query), this.overdueAnalytics(actor, query)]);
    return { kpis, workload, overdue };
  }

  async personal(actor: ScopedActor, query: DashboardQueryDto) {
    const kpis = await this.kpiSummary(actor, query);
    return { kpis };
  }
}
