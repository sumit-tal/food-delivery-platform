import type { LocationUpdateDto } from '../dto/location-update.dto';
import type { DbLocation, NearbyDriver } from '../interfaces';

/**
 * Interface for driver location repository
 */
export interface IDriverLocationRepository {
  /**
   * Save a batch of driver location updates
   */
  saveBatchLocations(locationUpdates: LocationUpdateDto[]): Promise<void>;
  
  /**
   * Save a single driver location update
   */
  saveLocation(locationUpdate: LocationUpdateDto): Promise<string>;
  
  /**
   * Get the latest location for a driver
   */
  getLatestLocation(driverId: string): Promise<DbLocation | null>;
  
  /**
   * Find nearby drivers within a specified radius
   */
  findNearbyDrivers(
    latitude: number, 
    longitude: number, 
    radiusMeters?: number, 
    limit?: number
  ): Promise<NearbyDriver[]>;
  
  /**
   * Get location history for a driver within a time range
   */
  getLocationHistory(
    driverId: string, 
    startTime: Date, 
    endTime: Date, 
    limit?: number
  ): Promise<DbLocation[]>;
}
