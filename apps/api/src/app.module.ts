import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { CorrelationIdMiddleware } from '@bus/shared';
import { env, envInt } from '@bus/config';
import { dataSourceOptions } from './database/data-source';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard, PermissionsGuard } from './common/guards';
import { AuditInterceptor } from './common/audit.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PassengersModule } from './modules/passengers/passengers.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { BusesModule } from './modules/buses/buses.module';
import { StopsModule } from './modules/stops/stops.module';
import { RoutesModule } from './modules/routes/routes.module';
import { TripsModule } from './modules/trips/trips.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { ResponsiblesModule } from './modules/responsibles/responsibles.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditProxyModule } from './modules/audit/audit.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { InternalModule } from './modules/internal/internal.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...dataSourceOptions(), autoLoadEntities: false, migrationsRun: false }),
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ name: 'default', ttl: 60000, limit: envInt('RATE_LIMIT_PER_MIN', 300) }],
        storage: new ThrottlerStorageRedisService(env('REDIS_URL', 'redis://localhost:6379')),
      }),
    }),
    CommonModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    PassengersModule,
    DriversModule,
    BusesModule,
    StopsModule,
    RoutesModule,
    SettingsModule,
    PricingModule,
    TripsModule,
    TicketsModule,
    BookingsModule,
    PaymentsModule,
    ResponsiblesModule,
    NotificationsModule,
    TrackingModule,
    ReportsModule,
    AuditProxyModule,
    MobileModule,
    InternalModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*splat}');
  }
}
