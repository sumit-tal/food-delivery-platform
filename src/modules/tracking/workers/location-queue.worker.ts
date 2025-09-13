import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DriverLocationRepository } from '../repositories/driver-location.repository';
import { LocationUpdateDto } from '../dto/location-update.dto';

/**
 * Worker for processing location updates from the queue
 */
@Processor('location-updates')
export class LocationQueueWorker {
  private readonly logger = new Logger(LocationQueueWorker.name);

  constructor(private readonly driverLocationRepository: DriverLocationRepository) {}

  /**
   * Process a batch of location updates
   */
  @Process()
  async process(job: Job<{ updates?: LocationUpdateDto[]; update?: LocationUpdateDto }>): Promise<{ processed: number }> {
    try {
      this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

      if (job.name === 'process-batch') {
        const { updates } = job.data;
        if (!updates || !Array.isArray(updates)) {
          throw new Error('Invalid job data: updates array is missing or not an array');
        }
        await this.processBatch(updates);
        return { processed: updates.length };
      } else if (job.name === 'process-single') {
        const { update } = job.data;
        if (!update) {
          throw new Error('Invalid job data: update is missing');
        }
        await this.processSingle(update);
        return { processed: 1 };
      }

      throw new Error(`Unknown job type: ${job.name}`);
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Process a batch of location updates
   */
  private async processBatch(updates: LocationUpdateDto[]): Promise<void> {
    try {
      this.logger.debug(`Processing batch of ${updates.length} location updates`);
      await this.driverLocationRepository.saveBatchLocations(updates);
    } catch (error) {
      this.logger.error(`Error processing batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Process a single location update
   */
  private async processSingle(update: LocationUpdateDto): Promise<void> {
    try {
      this.logger.debug(`Processing single location update for driver ${update.driverId}`);
      await this.driverLocationRepository.saveLocation(update);
    } catch (error) {
      this.logger.error(`Error processing single update: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
