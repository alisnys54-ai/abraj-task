import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

/** Wraps @nestjs/cache-manager with the same Redis instance the scheduler uses — one Redis, two roles (queue + cache). */
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: false,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get<string>('redis.host', 'localhost'),
            port: config.get<number>('redis.port', 6379),
            family: 0,
            ...(config.get<boolean>('redis.tls') ? { tls: true as const } : {}),
          },
          username: config.get<string>('redis.username'),
          password: config.get<string>('redis.password'),
        }),
        ttl: 30_000,
      }),
    }),
  ],
  exports: [CacheModule],
})
export class DashboardCacheModule {}
