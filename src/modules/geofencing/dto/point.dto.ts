import type { Point } from '../interfaces';

/**
 * Data Transfer Object for geographical point coordinates.
 */
export class PointDto implements Point {
  readonly latitude: number;
  readonly longitude: number;

  constructor(latitude?: number, longitude?: number) {
    if (latitude !== undefined && longitude !== undefined) {
      this.latitude = latitude;
      this.longitude = longitude;
    } else {
      this.latitude = 0;
      this.longitude = 0;
    }
  }
}
