import { Injectable } from '@nestjs/common';
import { Point } from '../interfaces';
import { GeoUtils } from '../utils/geo.utils';
import { ProximitySearchDto } from '../dto/proximity-search.dto';

/**
 * Interface for a location-based entity that can be used in proximity searches.
 */
export interface LocationEntity {
  readonly id: string;
  readonly location: Point;
  readonly [key: string]: any;
}

/**
 * Result of a proximity search, including distance.
 */
export interface ProximitySearchResult<T extends LocationEntity> {
  readonly entity: T;
  readonly distance: number; // Distance in meters
}

/**
 * Service for performing proximity searches on location-based entities.
 */
@Injectable()
export class ProximitySearchService {
  /**
   * Finds entities within a radius of a point.
   * 
   * @param entities - Array of location-based entities
   * @param searchParams - Search parameters
   * @returns Array of entities within the radius, sorted by distance
   */
  public findEntitiesWithinRadius<T extends LocationEntity>(
    entities: T[],
    searchParams: ProximitySearchDto
  ): ProximitySearchResult<T>[] {
    const results: ProximitySearchResult<T>[] = [];
    
    for (const entity of entities) {
      const distance: number = GeoUtils.calculateDistance(
        searchParams.location,
        entity.location
      );
      
      if (distance <= searchParams.radius) {
        results.push({
          entity,
          distance
        });
      }
    }
    
    // Sort by distance (closest first)
    results.sort((a, b) => a.distance - b.distance);
    
    // Apply limit if specified
    if (searchParams.limit && searchParams.limit > 0) {
      return results.slice(0, searchParams.limit);
    }
    
    return results;
  }

  /**
   * Calculates the distance between two points.
   * 
   * @param point1 - First point
   * @param point2 - Second point
   * @returns Distance in meters
   */
  public calculateDistance(point1: Point, point2: Point): number {
    return GeoUtils.calculateDistance(point1, point2);
  }
}
