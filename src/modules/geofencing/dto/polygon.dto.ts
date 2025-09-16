import type { Polygon } from '../interfaces';
import type { PointDto } from './point.dto';

/**
 * Data Transfer Object for polygon boundaries.
 */
export class PolygonDto implements Polygon {
  readonly points: PointDto[] | { latitude: number; longitude: number }[];

  constructor(points: PointDto[] | { latitude: number; longitude: number }[]) {
    this.points = points;
  }
}
