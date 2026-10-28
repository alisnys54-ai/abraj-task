import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TaskRemindersService } from './task-reminders.service';
import { TaskRemindersProcessor } from './task-reminders.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { TASK_REMINDERS_QUEUE } from './scheduler.constants';

export { TASK_REMINDERS_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          username: config.get<string>('redis.username'),
          password: config.get<string>('redis.password'),
          // 0 = resolve IPv4 or IPv6; Railway's private network is IPv6-only.
          family: 0,
          ...(config.get<boolean>('redis.tls') ? { tls: {} } : {}),
        },
      }),
    }),
    BullModule.registerQueue({
      name: TASK_REMINDERS_QUEUE,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 100 },
    }),
    NotificationsModule,
  ],
  providers: [TaskRemindersService, TaskRemindersProcessor],
  exports: [TaskRemindersService],
})
export class SchedulerModule {}
