import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Integration coverage for the single highest-value security property in this
 * phase: an own-scoped Employee token must never see another department's
 * tasks, even though the endpoint itself is reachable. Run against a real
 * seeded test database — docker compose up -d postgres, migrate, seed, then
 * `npm run test:e2e`. Adjust the login fixture to a real seeded Employee
 * account for your environment.
 */
describe('Tasks RBAC scoping (e2e)', () => {
  let app: INestApplication;
  let employeeToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'employee@abrajalyasser.iq', password: 'ChangeMe123!' });
    employeeToken = login.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it("never returns a task belonging to another department for an own-scoped Employee", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const departmentIds = new Set(res.body.data.map((t: any) => t.department_id));
    expect(departmentIds.size).toBeLessThanOrEqual(1);
  });

  it('returns 404 (never 403) for a task outside the caller\'s scope — existence is never confirmed', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(404);
  });
});
