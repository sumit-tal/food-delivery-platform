import type { PointDto } from './point.dto';

/**
 * Data Transfer Object for proximity search requests.
 */
export class ProximitySearchDto {
  readonly location: PointDto | { latitude: number; longitude: number };
  readonly radius: number; // Search radius in meters
  readonly limit?: number; // Maximum number of results to return

  constructor(location: PointDto | { latitude: number; longitude: number }, radius: number, limit?: number) {
    // Validate location
    this.location = location;
    
    // Validate radius
    if (typeof radius !== 'number' || radius < 0) {
      throw new Error('Radius must be a non-negative number');
    }
    this.radius = radius;
    
    // Validate limit if provided
    if (limit !== undefined && (typeof limit !== 'number' || limit < 1)) {
      throw new Error('Limit must be a positive number');
    }
    this.limit = limit;
  }
}
