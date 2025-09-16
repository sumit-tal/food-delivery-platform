import type { PolygonDto } from './polygon.dto';
import type { PointDto } from './point.dto';

/**
 * Data Transfer Object for creating a new geofence.
 */
export class CreateGeofenceDto {
  readonly name: string;
  readonly boundary: PolygonDto | { points: { latitude: number; longitude: number }[] };
  readonly center: PointDto | { latitude: number; longitude: number };
  readonly metadata?: Record<string, unknown>;
  
  constructor(data?: Partial<CreateGeofenceDto>) {
    if (data) {
      this.name = data.name as string;
      this.boundary = data.boundary as (PolygonDto | { points: { latitude: number; longitude: number }[] });
      this.center = data.center as (PointDto | { latitude: number; longitude: number });
      this.metadata = data.metadata;
    } else {
      this.name = '';
      this.boundary = { points: [] };
      this.center = { latitude: 0, longitude: 0 };
    }
  }
}
