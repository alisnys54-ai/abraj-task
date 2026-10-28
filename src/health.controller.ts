import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Liveness — process is up and responding. Deliberately checks nothing external; a slow DB/Redis should never make Kubernetes kill and restart a perfectly healthy process. */
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness — this instance can actually serve traffic (DB + Redis reachable). Used by a load balancer/orchestrator to decide whether to route requests here. */
  @Public()
  @Get('ready')
  async ready(@Res() res: Response) {
    const checks: Record<string, 'ok' | 'error'> = { database: 'ok', redis: 'ok' };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = 'error';
    }

    try {
      const redis = new Redis({
        host: this.config.get<string>('redis.host', 'localhost'),
        port: this.config.get<number>('redis.port', 6379),
        username: this.config.get<string>('redis.username'),
        password: this.config.get<string>('redis.password'),
        family: 0,
        ...(this.config.get<boolean>('redis.tls') ? { tls: {} } : {}),
        lazyConnect: true,
        connectTimeout: 1500,
        maxRetriesPerRequest: 0,
      });
      await redis.connect();
      await redis.ping();
      redis.disconnect();
    } catch {
      checks.redis = 'error';
    }

    const healthy = Object.values(checks).every((v) => v === 'ok');
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({ status: healthy ? 'ready' : 'not_ready', checks, timestamp: new Date().toISOString() });
  }
}
