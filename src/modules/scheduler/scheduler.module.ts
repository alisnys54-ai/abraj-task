import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TaskRemindersService } from './task-reminders.service';
import { TaskRemindersProcessor } from './task-reminders.processor';
import { NotificationsModule } from '../notifications/notifications.module';

export const TASK_REMINDERS_QUEUE = 'task-reminders';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { host: config.get<string>('redis.host', 'localhost'), port: config.get<number>('redis.port', 6379) },
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
