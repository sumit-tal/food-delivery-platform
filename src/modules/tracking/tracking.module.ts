import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingGateway } from './tracking.gateway';
import { LocationProcessingService } from './services/location-processing.service';
import { DatabaseService } from './services/database.service';
import { LocationQueueService } from './services/location-queue.service';
import { DriverLocationRepository } from './repositories/driver-location.repository';
import { ActiveDeliveryRepository } from './repositories/active-delivery.repository';
import { ConnectionManagerService } from './services/connection-manager.service';
import { BullModule } from '@nestjs/bull';

/**
 * TrackingModule handles real-time driver location tracking
 * with high-throughput processing and minimal lag
 */
@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueueAsync({
      name: 'location-updates',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_URL', 'localhost').split(':')[0],
          port: parseInt(configService.get('REDIS_URL', 'localhost:6379').split(':')[1] || '6379'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: 1000,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [TrackingController],
  providers: [
    TrackingService,
    TrackingGateway,
    LocationProcessingService,
    DatabaseService,
    LocationQueueService,
    DriverLocationRepository,
    ActiveDeliveryRepository,
    ConnectionManagerService,
  ],
  exports: [TrackingService],
})
export class TrackingModule {}
