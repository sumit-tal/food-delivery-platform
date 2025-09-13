import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocationUpdateDto } from '../dto/location-update.dto';
import { LocationQueueService } from './location-queue.service';
import { DriverLocationRepository } from '../repositories/driver-location.repository';
import { ActiveDeliveryRepository } from '../repositories/active-delivery.repository';
import { TrackingGateway } from '../tracking.gateway';

/**
 * Service for processing driver location updates
 * Handles high-throughput updates with batching and in-memory processing
 */
@Injectable()
export class LocationProcessingService {
  private readonly logger = new Logger(LocationProcessingService.name);
  private readonly inMemoryLocations = new Map<
    string,
    {
      latitude: number;
      longitude: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
      batteryLevel?: number;
      timestamp: string;
      expiresAt: number;
    }
  >();
  private readonly activeDeliveries = new Map<string, string>(); // orderId -> driverId
  private readonly batchSize: number;
  private readonly batchIntervalMs: number;
  private readonly locationTtlSeconds: number;
  private batchTimer: NodeJS.Timeout | null = null;
  private locationBatch: LocationUpdateDto[] = [];

  constructor(
    private readonly locationQueueService: LocationQueueService,
    private readonly driverLocationRepository: DriverLocationRepository,
    private readonly activeDeliveryRepository: ActiveDeliveryRepository,
    private readonly trackingGateway: TrackingGateway,
    private readonly configService: ConfigService,
  ) {
    this.batchSize = this.configService.get<number>('LOCATION_BATCH_SIZE', 100);
    this.batchIntervalMs = this.configService.get<number>('LOCATION_BATCH_INTERVAL_MS', 1000);
    this.locationTtlSeconds = this.configService.get<number>('DRIVER_LOCATION_TTL_SECONDS', 300);

    // Start the batch processing timer
    this.startBatchProcessing();
  }

  /**
   * Process a location update from a driver
   */
  async processLocationUpdate(locationUpdate: LocationUpdateDto): Promise<void> {
    try {
      const { driverId, orderId } = locationUpdate;

      // Store the latest location in memory for fast access
      this.updateInMemoryLocation(locationUpdate);

      // Add to batch for database persistence
      this.addToBatch(locationUpdate);

      // If this is for an active delivery, broadcast to subscribed clients
      if (orderId) {
        this.broadcastLocationUpdate(orderId, locationUpdate);
      } else {
        // Check if driver has an active delivery
        const activeOrderId =
          await this.activeDeliveryRepository.findActiveOrderByDriverId(driverId);
        if (activeOrderId) {
          // Cache the association for future updates
          this.activeDeliveries.set(activeOrderId, driverId);
          this.broadcastLocationUpdate(activeOrderId, locationUpdate);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing location update: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Update the in-memory location cache
   */
  private updateInMemoryLocation(locationUpdate: LocationUpdateDto): void {
    const { driverId } = locationUpdate;

    // Store with timestamp for TTL management
    this.inMemoryLocations.set(driverId, {
      ...locationUpdate,
      timestamp: locationUpdate.timestamp || new Date().toISOString(),
      expiresAt: Date.now() + this.locationTtlSeconds * 1000,
    });
  }

  /**
   * Add a location update to the batch for database persistence
   */
  private addToBatch(locationUpdate: LocationUpdateDto): void {
    this.locationBatch.push(locationUpdate);
    // If batch size threshold is reached, process immediately
    if (this.locationBatch.length >= this.batchSize) {
      void this.processBatch();
    }
  }

  /**
   * Start the batch processing timer
   */
  private startBatchProcessing(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(() => {
      if (this.locationBatch.length > 0) {
        void this.processBatch();
      }
    }, this.batchIntervalMs);
  }

  /**
   * Process the current batch of location updates
   */
  private async processBatch(): Promise<void> {
    if (this.locationBatch.length === 0) {
      return;
    }

    const batchToProcess = [...this.locationBatch];
    this.locationBatch = []; // Clear the batch

    try {
      // Queue the batch for database persistence
      await this.locationQueueService.queueLocationBatch(batchToProcess);

      this.logger.debug(`Queued ${batchToProcess.length} location updates for processing`);
    } catch (error) {
      this.logger.error(
        `Error processing location batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Put failed items back in the batch
      this.locationBatch = [...batchToProcess, ...this.locationBatch];
    }
  }

  /**
   * Broadcast a location update to subscribed clients
   */
  private broadcastLocationUpdate(orderId: string, locationUpdate: LocationUpdateDto): void {
    const { latitude, longitude, heading } = locationUpdate;

    // Prepare the data to broadcast in the format expected by broadcastDriverLocation
    const broadcastData = {
      latitude,
      longitude,
      heading,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all clients subscribed to this order
    this.trackingGateway.broadcastDriverLocation(orderId, broadcastData);
  }

  /**
   * Get the latest location for a driver from in-memory cache
   */
  getDriverLocation(driverId: string): {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
    batteryLevel?: number;
    timestamp: string;
    expiresAt: number;
  } | null {
    const locationData = this.inMemoryLocations.get(driverId);

    // Check if the location data exists and hasn't expired
    if (locationData && locationData.expiresAt > Date.now()) {
      return locationData;
    }

    // Remove expired data
    if (locationData) {
      this.inMemoryLocations.delete(driverId);
    }

    return null;
  }

  /**
   * Clean up resources when the service is destroyed
   */
  onModuleDestroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Process any remaining items in the batch
    if (this.locationBatch.length > 0) {
      this.processBatch().catch((err) => {
        this.logger.error(
          `Error processing final batch: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      });
    }
  }
}
