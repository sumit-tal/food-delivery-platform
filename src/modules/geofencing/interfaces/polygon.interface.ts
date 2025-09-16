import type { Point } from './point.interface';

/**
 * Represents a polygon defined by an array of points.
 * The points should form a closed loop (the first and last points are connected).
 */
export interface Polygon {
  readonly points: Point[];
}
