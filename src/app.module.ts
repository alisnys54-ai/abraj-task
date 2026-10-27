import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { PositionsModule } from './modules/positions/positions.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TaskChecklistsModule } from './modules/task-checklists/task-checklists.module';
import { TaskCommentsModule } from './modules/task-comments/task-comments.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { SavedFiltersModule } from './modules/saved-filters/saved-filters.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MeModule } from './modules/me/me.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PortalsModule } from './modules/portals/portals.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { AssetsModule } from './modules/assets/assets.module';
import { ReProjectsModule } from './modules/re-projects/re-projects.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { SiteOperationsModule } from './modules/site-operations/site-operations.module';
import { FileHubModule } from './modules/file-hub/file-hub.module';
import { HealthController } from './health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ForcePasswordChangeGuard } from './common/guards/force-password-change.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { SystemOwnerGuard } from './common/guards/system-owner.guard';
import { PortalAccessGuard } from './common/guards/portal-access.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ name: 'default', ttl: config.get<number>('throttle.ttl', 60) * 1000, limit: config.get<number>('throttle.limit', 20) }],
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    DepartmentsModule,
    PositionsModule,
    ActivityLogModule,
    NotificationsModule,
    TasksModule,
    TaskChecklistsModule,
    TaskCommentsModule,
    AttachmentsModule,
    SavedFiltersModule,
    DashboardModule,
    ReportsModule,
    MeModule,
    SettingsModule,
    // Unified platform
    PortalsModule,
    EmployeesModule,
    AttendanceModule,
    LeavesModule,
    PayrollModule,
    AnnouncementsModule,
    AssetsModule,
    ReProjectsModule,
    BookingsModule,
    SiteOperationsModule,
    FileHubModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate-limit -> authenticate -> first-login lock -> permission -> portal -> system-owner.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ForcePasswordChangeGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: PortalAccessGuard },
    { provide: APP_GUARD, useClass: SystemOwnerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
