import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ProximitySearchService, LocationEntity, ProximitySearchResult } from '../services/proximity-search.service';
import { ProximitySearchDto } from '../dto/proximity-search.dto';
import { Point } from '../interfaces';

/**
 * Controller for proximity search operations.
 */
@Controller('proximity')
export class ProximitySearchController {
  constructor(private readonly proximitySearchService: ProximitySearchService) {}

  /**
   * Calculates the distance between two points.
   * 
   * @param origin - Origin point
   * @param destination - Destination point
   * @returns Distance in meters
   */
  @Post('distance')
  public calculateDistance(
    @Body('origin') origin: Point,
    @Body('destination') destination: Point
  ): { distance: number } {
    const distance: number = this.proximitySearchService.calculateDistance(origin, destination);
    return { distance };
  }

  /**
   * Performs a proximity search for restaurants.
   * 
   * @param searchDto - Search parameters
   * @returns Array of restaurants within the radius, sorted by distance
   */
  @Post('restaurants')
  public async findRestaurantsNearby(
    @Body() searchDto: ProximitySearchDto
  ): Promise<ProximitySearchResult<LocationEntity>[]> {
    // This would typically call a restaurant service to get all restaurants
    // For now, we'll return an empty array as this is just the controller interface
    return [];
  }

  /**
   * Performs a proximity search for drivers.
   * 
   * @param searchDto - Search parameters
   * @returns Array of drivers within the radius, sorted by distance
   */
  @Post('drivers')
  public async findDriversNearby(
    @Body() searchDto: ProximitySearchDto
  ): Promise<ProximitySearchResult<LocationEntity>[]> {
    // This would typically call a driver service to get all available drivers
    // For now, we'll return an empty array as this is just the controller interface
    return [];
  }

  /**
   * Finds entities within a radius of a point (generic endpoint).
   * 
   * @param lat - Latitude
   * @param lng - Longitude
   * @param radius - Radius in meters
   * @param entityType - Type of entity to search for
   * @param limit - Maximum number of results to return
   * @returns Array of entities within the radius, sorted by distance
   */
  @Get('search')
  public async findEntitiesNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number,
    @Query('entityType') entityType: string,
    @Query('limit') limit?: number
  ): Promise<ProximitySearchResult<LocationEntity>[]> {
    const searchDto: ProximitySearchDto = {
      location: { latitude: lat, longitude: lng },
      radius,
      limit
    };
    
    // This would typically call different services based on entityType
    // For now, we'll return an empty array as this is just the controller interface
    return [];
  }
}
