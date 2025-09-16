import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Redis } from 'ioredis';

// Controllers
import { GeofenceController } from './controllers/geofence.controller';
import { ProximitySearchController } from './controllers/proximity-search.controller';
import { DeliveryZoneController } from './controllers/delivery-zone.controller';
import { DriverAssignmentController } from './controllers/driver-assignment.controller';
import { GeofenceEventController } from './controllers/geofence-event.controller';

// Services
import { GeofenceService } from './services/geofence.service';
import { ProximitySearchService } from './services/proximity-search.service';
import { DeliveryZoneService } from './services/delivery-zone.service';
import { DriverAssignmentService } from './services/driver-assignment.service';
import { GeofenceEventService } from './services/geofence-event.service';

// Repositories
import { GeofenceRepository } from './repositories/geofence.repository';

// Cache
import { GeoCache } from './cache/geo-cache.interface';
import { InMemoryGeoCache } from './cache/in-memory-geo-cache';
import { RedisGeoCache } from './cache/redis-geo-cache';

@Module({
  imports: [ConfigModule, EventEmitterModule.forRoot({})],
  controllers: [
    GeofenceController,
    ProximitySearchController,
    DeliveryZoneController,
    DriverAssignmentController,
    GeofenceEventController,
  ],
  providers: [
    GeofenceService,
    ProximitySearchService,
    DeliveryZoneService,
    DriverAssignmentService,
    GeofenceEventService,
    GeofenceRepository,
    {
      provide: 'GEO_CACHE',
      useFactory: (configService: ConfigService) => {
        const cacheProvider = configService.get<string>('CACHE_PROVIDER', 'memory');

        if (cacheProvider === 'redis') {
          const redisUrl = configService.get<string>('REDIS_URL');

          if (!redisUrl) {
            throw new Error('REDIS_URL is required when CACHE_PROVIDER is set to "redis"');
          }

          const redisClient = new Redis(redisUrl);
          return new RedisGeoCache(redisClient, configService);
        }

        return new InMemoryGeoCache();
      },
      inject: [ConfigService],
    },
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          return null;
        }

        return new Redis(redisUrl);
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    GeofenceService,
    ProximitySearchService,
    DeliveryZoneService,
    DriverAssignmentService,
    GeofenceEventService,
    'GEO_CACHE',
  ],
})
export class GeofencingModule {}
