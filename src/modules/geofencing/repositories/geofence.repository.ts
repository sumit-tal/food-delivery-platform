import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Geofence, Point } from '../interfaces';
import { GridIndex } from '../spatial-index/grid-index';

/**
 * Repository for managing geofences with spatial indexing capabilities.
 */
@Injectable()
export class GeofenceRepository {
  private readonly spatialIndex: GridIndex;

  constructor() {
    this.spatialIndex = new GridIndex();
  }

  /**
   * Creates a new geofence.
   * 
   * @param geofence - Geofence data without ID, createdAt, and updatedAt
   * @returns The created geofence
   */
  public create(geofence: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>): Geofence {
    const now: Date = new Date();
    const newGeofence: Geofence = {
      ...geofence,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    this.spatialIndex.addGeofence(newGeofence);
    return newGeofence;
  }

  /**
   * Finds a geofence by ID.
   * 
   * @param id - Geofence ID
   * @returns The geofence if found, undefined otherwise
   */
  public findById(id: string): Geofence | undefined {
    return this.spatialIndex.getAllGeofences().find(geofence => geofence.id === id);
  }

  /**
   * Finds all geofences.
   * 
   * @returns Array of all geofences
   */
  public findAll(): Geofence[] {
    return this.spatialIndex.getAllGeofences();
  }

  /**
   * Finds all geofences that contain the specified point.
   * 
   * @param point - The point to check
   * @returns Array of geofences containing the point
   */
  public findByPoint(point: Point): Geofence[] {
    return this.spatialIndex.findGeofencesContainingPoint(point);
  }

  /**
   * Finds all geofences within the specified radius of the point.
   * 
   * @param center - Center point for the search
   * @param radiusMeters - Search radius in meters
   * @returns Array of geofences within the radius
   */
  public findByRadius(center: Point, radiusMeters: number): Geofence[] {
    return this.spatialIndex.findGeofencesWithinRadius(center, radiusMeters);
  }

  /**
   * Updates a geofence.
   * 
   * @param id - Geofence ID
   * @param geofence - Updated geofence data
   * @returns The updated geofence if found, undefined otherwise
   */
  public update(id: string, geofence: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>): Geofence | undefined {
    const existingGeofence: Geofence | undefined = this.findById(id);

    if (!existingGeofence) {
      return undefined;
    }

    // Remove the old geofence from the spatial index
    this.spatialIndex.removeGeofence(id);

    // Create the updated geofence
    const updatedGeofence: Geofence = {
      ...geofence,
      id,
      createdAt: existingGeofence.createdAt,
      updatedAt: new Date()
    };

    // Add the updated geofence to the spatial index
    this.spatialIndex.addGeofence(updatedGeofence);

    return updatedGeofence;
  }

  /**
   * Deletes a geofence.
   * 
   * @param id - Geofence ID
   * @returns True if the geofence was deleted, false if it wasn't found
   */
  public delete(id: string): boolean {
    return this.spatialIndex.removeGeofence(id);
  }

  /**
   * Gets the number of geofences.
   * 
   * @returns Number of geofences
   */
  public count(): number {
    return this.spatialIndex.getGeofenceCount();
  }
}
