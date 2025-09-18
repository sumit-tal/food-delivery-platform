import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { validate } from './config/validate-env';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RolesGuard } from './common/guards/roles.guard';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { SimulatorModule } from './modules/simulator/simulator.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { DatabaseModule } from './modules/database/database.module';
import { ObservabilityModule } from './modules/observability/observability.module';

/**
 * AppModule is the root module of the SwiftEats backend application.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ProfilesModule,
    RestaurantsModule,
    OrdersModule,
    PaymentsModule,
    TrackingModule,
    SimulatorModule,
    NotificationsModule,
    PerformanceModule,
    ObservabilityModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: RolesGuard }
  ]
})
export class AppModule {}
