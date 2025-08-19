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

/**
 * AppModule is the root module of the SwiftEats backend application.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    HealthModule,
    UsersModule,
    AuthModule,
    ProfilesModule,
    RestaurantsModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: RolesGuard }
  ]
})
export class AppModule {}
