import { Point } from './point.interface';
import { Polygon } from './polygon.interface';

/**
 * Represents a geofenced area with an identifier, boundary, and metadata.
 */
export interface Geofence {
  readonly id: string;
  readonly name: string;
  readonly boundary: Polygon;
  readonly center: Point;
  readonly radius?: number; // Optional radius in meters for circular geofences
  readonly metadata?: Record<string, any>; // Additional metadata for the geofence
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
