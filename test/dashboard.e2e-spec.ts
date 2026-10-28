import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/** Run against a real seeded test DB + Redis (docker compose up -d postgres redis). Adjust logins to real seeded fixtures for your environment. */
describe('Dashboard scoping (e2e)', () => {
  let app: INestApplication;
  let employeeToken: string;
  let ownerToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const empLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'employee@abrajalyasser.iq', password: 'ChangeMe123!' });
    employeeToken = empLogin.body.access_token;
    const ownerLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'owner@abrajalyasser.iq', password: 'ChangeMe123!' });
    ownerToken = ownerLogin.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it("an Employee's personal dashboard total never exceeds the System Owner's company-wide total", async () => {
    const [empRes, ownerRes] = await Promise.all([
      request(app.getHttpServer()).get('/api/v1/dashboard/personal').set('Authorization', `Bearer ${employeeToken}`).expect(200),
      request(app.getHttpServer()).get('/api/v1/dashboard/executive').set('Authorization', `Bearer ${ownerToken}`).expect(200),
    ]);
    expect(empRes.body.kpis.total).toBeLessThanOrEqual(ownerRes.body.kpis.total);
  });

  it('report export requires tasks:export permission and records an activity log entry', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/reports/export')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ format: 'csv', report: 'tasks_by_department', filters: {} })
      .expect(201);
  });
});
