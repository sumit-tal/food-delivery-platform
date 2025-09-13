import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { LocationUpdateDto } from '../dto/location-update.dto';

/**
 * Service for queuing location updates for asynchronous processing
 * Uses BullMQ for reliable message queuing
 */
@Injectable()
export class LocationQueueService {
  private readonly logger = new Logger(LocationQueueService.name);

  constructor(
    @InjectQueue('location-updates') private readonly locationQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Queue a batch of location updates for processing
   */
  async queueLocationBatch(locationUpdates: LocationUpdateDto[]): Promise<void> {
    try {
      // Add the batch to the queue
      await this.locationQueue.add('process-batch', {
        updates: locationUpdates,
        timestamp: new Date().toISOString(),
        count: locationUpdates.length,
      }, {
        removeOnComplete: true,
        removeOnFail: 1000,
      });
    } catch (error) {
      this.logger.error(`Error queuing location batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Queue a single location update for processing
   */
  async queueLocationUpdate(locationUpdate: LocationUpdateDto): Promise<void> {
    try {
      // Add the update to the queue
      await this.locationQueue.add('process-single', {
        update: locationUpdate,
        timestamp: new Date().toISOString(),
      }, {
        removeOnComplete: true,
        removeOnFail: 1000,
      });
    } catch (error) {
      this.logger.error(`Error queuing location update: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
