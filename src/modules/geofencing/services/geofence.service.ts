import { Injectable } from '@nestjs/common';
import { Geofence, Point } from '../interfaces';
import { GeofenceRepository } from '../repositories/geofence.repository';
import { CreateGeofenceDto } from '../dto/create-geofence.dto';

/**
 * Service for managing geofences and performing spatial queries.
 */
@Injectable()
export class GeofenceService {
  constructor(private readonly geofenceRepository: GeofenceRepository) {}

  /**
   * Creates a new geofence.
   * 
   * @param createGeofenceDto - Data for creating a geofence
   * @returns The created geofence
   */
  public createGeofence(createGeofenceDto: CreateGeofenceDto): Geofence {
    return this.geofenceRepository.create({
      name: createGeofenceDto.name,
      boundary: createGeofenceDto.boundary,
      center: createGeofenceDto.center,
      metadata: createGeofenceDto.metadata
    });
  }

  /**
   * Gets a geofence by ID.
   * 
   * @param id - Geofence ID
   * @returns The geofence if found, undefined otherwise
   */
  public getGeofenceById(id: string): Geofence | undefined {
    return this.geofenceRepository.findById(id);
  }

  /**
   * Gets all geofences.
   * 
   * @returns Array of all geofences
   */
  public getAllGeofences(): Geofence[] {
    return this.geofenceRepository.findAll();
  }

  /**
   * Checks if a point is inside any geofence.
   * 
   * @param point - The point to check
   * @returns Array of geofences containing the point
   */
  public findGeofencesContainingPoint(point: Point): Geofence[] {
    return this.geofenceRepository.findByPoint(point);
  }

  /**
   * Finds all geofences within a radius of a point.
   * 
   * @param center - Center point for the search
   * @param radiusMeters - Search radius in meters
   * @returns Array of geofences within the radius
   */
  public findGeofencesWithinRadius(center: Point, radiusMeters: number): Geofence[] {
    return this.geofenceRepository.findByRadius(center, radiusMeters);
  }

  /**
   * Updates a geofence.
   * 
   * @param id - Geofence ID
   * @param updateGeofenceDto - Updated geofence data
   * @returns The updated geofence if found, undefined otherwise
   */
  public updateGeofence(id: string, updateGeofenceDto: CreateGeofenceDto): Geofence | undefined {
    return this.geofenceRepository.update(id, {
      name: updateGeofenceDto.name,
      boundary: updateGeofenceDto.boundary,
      center: updateGeofenceDto.center,
      metadata: updateGeofenceDto.metadata
    });
  }

  /**
   * Deletes a geofence.
   * 
   * @param id - Geofence ID
   * @returns True if the geofence was deleted, false if it wasn't found
   */
  public deleteGeofence(id: string): boolean {
    return this.geofenceRepository.delete(id);
  }
}
