import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';

/** Confirms scope is respected end-to-end at the Service layer and that the Redis cache never leaks one actor's cached result to another with a different scope/user. */
describe('DashboardService — scoping and caching', () => {
  let service: DashboardService;
  let repo: any;
  let cacheStore: Map<string, unknown>;

  beforeEach(async () => {
    cacheStore = new Map();
    repo = { kpiSummary: jest.fn().mockResolvedValue({ total: 5 }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DashboardRepository, useValue: repo },
        {
          provide: 'CACHE_MANAGER',
          useValue: {
            get: (key: string) => Promise.resolve(cacheStore.get(key)),
            set: (key: string, val: unknown) => { cacheStore.set(key, val); return Promise.resolve(); },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('computes once and serves the second identical call from cache', async () => {
    const actor = { userId: 'u1', scope: 'own' as const };
    await service.kpiSummary(actor, {});
    await service.kpiSummary(actor, {});
    expect(repo.kpiSummary).toHaveBeenCalledTimes(1);
  });

  it('never shares a cache entry between two different users', async () => {
    await service.kpiSummary({ userId: 'u1', scope: 'own' }, {});
    await service.kpiSummary({ userId: 'u2', scope: 'own' }, {});
    expect(repo.kpiSummary).toHaveBeenCalledTimes(2);
  });

  it('never shares a cache entry between two different scopes for the same user', async () => {
    await service.kpiSummary({ userId: 'u1', scope: 'own' }, {});
    await service.kpiSummary({ userId: 'u1', scope: 'department' }, {});
    expect(repo.kpiSummary).toHaveBeenCalledTimes(2);
  });
});
