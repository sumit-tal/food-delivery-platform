import { LocationUpdateDto } from '../dto/location-update.dto';
import { InMemoryLocation } from '../interfaces';

/**
 * Interface for location processing service
 */
export interface ILocationProcessingService {
  /**
   * Process a location update
   */
  processLocationUpdate(locationUpdate: LocationUpdateDto): Promise<void>;
  
  /**
   * Get the latest location for a driver from in-memory cache
   */
  getDriverLocation(driverId: string): InMemoryLocation | null;
}
