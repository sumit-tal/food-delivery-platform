import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LocationUpdateDto } from './dto/location-update.dto';
import { LocationProcessingService } from './services/location-processing.service';
import { DriverLocationRepository } from './repositories/driver-location.repository';
import { ActiveDeliveryRepository } from './repositories/active-delivery.repository';
import { DriverLocation, NearbyDriver, OrderTracking, InMemoryLocation, DbLocation, ActiveDelivery } from './interfaces';

/**
 * Service for driver tracking operations
 */
@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly locationProcessingService: LocationProcessingService,
    private readonly driverLocationRepository: DriverLocationRepository,
    private readonly activeDeliveryRepository: ActiveDeliveryRepository,
  ) {}

  /**
   * Process a location update from a driver
   */
  async processLocationUpdate(locationUpdate: LocationUpdateDto): Promise<string> {
    try {
      // Process the location update through the pipeline
      await this.locationProcessingService.processLocationUpdate(locationUpdate);
      
      // Save the location directly for HTTP fallback
      const locationId = await this.driverLocationRepository.saveLocation(locationUpdate);
      
      return locationId;
    } catch (error) {
      this.logger.error(`Error processing location update: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get the latest location for a driver
   */
  async getDriverLocation(driverId: string): Promise<DriverLocation> {
    try {
      return await this.getDriverLocationInternal(driverId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error getting driver location: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Internal method to get driver location from memory or database
   */
  private async getDriverLocationInternal(driverId: string): Promise<DriverLocation> {
    // First check in-memory cache for the most recent location
    const inMemoryLocation = this.locationProcessingService.getDriverLocation(driverId) as InMemoryLocation | null;
    
    if (inMemoryLocation) {
      return this.mapInMemoryLocationToDriverLocation(driverId, inMemoryLocation);
    }
    
    // Fall back to database if not in memory
    const dbLocation = await this.driverLocationRepository.getLatestLocation(driverId);
    
    if (!dbLocation) {
      throw new NotFoundException(`No location data found for driver ${driverId}`);
    }
    
    return this.mapDbLocationToDriverLocation(dbLocation);
  }
  
  /**
   * Map in-memory location to driver location interface
   */
  private mapInMemoryLocationToDriverLocation(driverId: string, location: InMemoryLocation): DriverLocation {
    return {
      driverId,
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading,
      speed: location.speed,
      timestamp: location.timestamp,
      source: 'memory',
    };
  }
  
  /**
   * Map database location to driver location interface
   */
  private mapDbLocationToDriverLocation(location: DbLocation): DriverLocation {
    return {
      driverId: location.driver_id,
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading,
      speed: location.speed,
      timestamp: location.timestamp,
      source: 'database',
    };
  }

  /**
   * Get location history for a driver
   */
  async getDriverLocationHistory(driverId: string, startTime: Date, endTime: Date, limit: number = 100): Promise<DriverLocation[]> {
    try {
      const locations = await this.driverLocationRepository.getLocationHistory(driverId, startTime, endTime, limit);
      return locations.map(location => this.mapDbLocationToDriverLocation(location));
    } catch (error) {
      this.logger.error(`Error getting driver location history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Find nearby drivers
   */
  async findNearbyDrivers(latitude: number, longitude: number, radiusMeters: number = 5000, limit: number = 10): Promise<NearbyDriver[]> {
    try {
      return await this.driverLocationRepository.findNearbyDrivers(latitude, longitude, radiusMeters, limit);
    } catch (error) {
      this.logger.error(`Error finding nearby drivers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get tracking information for an order
   */
  async getOrderTracking(orderId: string): Promise<OrderTracking> {
    try {
      return await this.getOrderTrackingInternal(orderId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error getting order tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Internal method to get order tracking information
   */
  private async getOrderTrackingInternal(orderId: string): Promise<OrderTracking> {
    // Get the active delivery information and driver location
    const [delivery, driverLocation] = await this.getDeliveryAndDriverLocation(orderId);
    
    // Combine delivery and location information
    return this.createOrderTrackingResponse(delivery, driverLocation);
  }
  
  /**
   * Helper method to get delivery and driver location
   */
  private async getDeliveryAndDriverLocation(orderId: string): Promise<[ActiveDelivery, DriverLocation]> {
    const delivery = await this.activeDeliveryRepository.getActiveDeliveryByOrderId(orderId);
    
    if (!delivery) {
      throw new NotFoundException(`No active delivery found for order ${orderId}`);
    }
    
    // Get the driver's current location
    const driverLocation = await this.getDriverLocation(delivery.driver_id);
    
    return [delivery, driverLocation];
  }
  
  /**
   * Create order tracking response from delivery and driver location
   */
  private createOrderTrackingResponse(delivery: ActiveDelivery, driverLocation: DriverLocation): OrderTracking {
    return {
      orderId: delivery.order_id,
      deliveryId: delivery.id,
      status: delivery.status,
      driverId: delivery.driver_id,
      pickup: this.createLocationPoint(delivery.pickup_latitude, delivery.pickup_longitude),
      destination: this.createLocationPoint(delivery.delivery_latitude, delivery.delivery_longitude),
      currentLocation: this.createDriverLocationPoint(driverLocation),
      startedAt: delivery.started_at,
      estimatedDeliveryTime: delivery.estimated_delivery_time,
      completedAt: delivery.completed_at,
    };
  }
  
  /**
   * Create a location point
   */
  private createLocationPoint(latitude: number, longitude: number): { latitude: number; longitude: number } {
    return { latitude, longitude };
  }
  
  /**
   * Create a driver location point with heading and timestamp
   */
  private createDriverLocationPoint(location: DriverLocation): { latitude: number; longitude: number; heading?: number; updatedAt: Date } {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading,
      updatedAt: location.timestamp,
    };
  }

  /**
   * Create a new active delivery
   */
  async createActiveDelivery(
    orderId: string,
    driverId: string,
    pickupLatitude: number,
    pickupLongitude: number,
    deliveryLatitude: number,
    deliveryLongitude: number,
    estimatedDeliveryTime?: Date
  ): Promise<string> {
    try {
      return this.createDeliveryInRepository(
        orderId, driverId, pickupLatitude, pickupLongitude,
        deliveryLatitude, deliveryLongitude, estimatedDeliveryTime
      );
    } catch (error) {
      this.logger.error(`Error creating active delivery: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Helper method to create delivery in repository
   */
  private async createDeliveryInRepository(
    orderId: string,
    driverId: string,
    pickupLatitude: number,
    pickupLongitude: number,
    deliveryLatitude: number,
    deliveryLongitude: number,
    estimatedDeliveryTime?: Date
  ): Promise<string> {
    return this.activeDeliveryRepository.createActiveDelivery(
      orderId,
      driverId,
      pickupLatitude,
      pickupLongitude,
      deliveryLatitude,
      deliveryLongitude,
      estimatedDeliveryTime
    );
  }

  /**
   * Update the status of an active delivery
   */
  async updateDeliveryStatus(deliveryId: string, status: string): Promise<void> {
    try {
      await this.activeDeliveryRepository.updateDeliveryStatus(deliveryId, status);
    } catch (error) {
      this.logger.error(`Error updating delivery status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
