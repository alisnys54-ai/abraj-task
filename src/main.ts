import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // Base64 photo/scan uploads (≤25 MB decoded ≈ 34 MB encoded) arrive as JSON.
  app.useBodyParser('json', { limit: '40mb' });
  const config = app.get(ConfigService);

  // Required for correct req.ip (and therefore correct per-IP rate limiting and
  // audit logging) once this sits behind the approved nginx/traefik reverse proxy.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet({
    // A pure JSON API with a Swagger UI page — default CSP blocks Swagger's inline
    // assets. Other Helmet protections (frameguard, noSniff, HSTS, etc.) stay on.
    contentSecurityPolicy: false,
  }));

  // credentials:true with a wildcard origin is invalid per the CORS spec (browsers
  // reject it) and is also unneeded for a bearer-token API — only enable it when a
  // real origin is configured.
  const corsOrigin = config.get<string>('corsOrigin', '*');
  app.enableCors({ origin: corsOrigin, credentials: corsOrigin !== '*' });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix(config.get<string>('apiPrefix', 'api'));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Abraj Al Yasir Tasks API')
    .setDescription('Phase 1 — Authentication module')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}/api/v1 — docs at http://localhost:${port}/api/docs`);
}
bootstrap();
