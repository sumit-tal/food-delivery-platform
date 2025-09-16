import { Point } from '../interfaces';

/**
 * Utility functions for geospatial calculations.
 */
export class GeoUtils {
  /**
   * Earth radius in meters.
   */
  private static readonly EARTH_RADIUS_METERS: number = 6371000;

  /**
   * Converts degrees to radians.
   * 
   * @param degrees - Angle in degrees
   * @returns Angle in radians
   */
  public static degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculates the distance between two points using the Haversine formula.
   * 
   * @param point1 - First geographical point
   * @param point2 - Second geographical point
   * @returns Distance in meters
   */
  public static calculateDistance(point1: Point, point2: Point): number {
    const lat1Rad: number = this.degreesToRadians(point1.latitude);
    const lat2Rad: number = this.degreesToRadians(point2.latitude);
    
    const latDiffRad: number = this.degreesToRadians(point2.latitude - point1.latitude);
    const lngDiffRad: number = this.degreesToRadians(point2.longitude - point1.longitude);

    const a: number = 
      Math.sin(latDiffRad / 2) * Math.sin(latDiffRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(lngDiffRad / 2) * Math.sin(lngDiffRad / 2);
    
    const c: number = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return this.EARTH_RADIUS_METERS * c;
  }

  /**
   * Checks if a point is inside a polygon using the ray casting algorithm.
   * 
   * @param point - The point to check
   * @param polygon - Array of points forming a polygon
   * @returns True if the point is inside the polygon, false otherwise
   */
  public static isPointInPolygon(point: Point, polygon: Point[]): boolean {
    if (polygon.length < 3) {
      return false;
    }

    let inside: boolean = false;
    
    for (let i: number = 0, j: number = polygon.length - 1; i < polygon.length; j = i++) {
      const xi: number = polygon[i].longitude;
      const yi: number = polygon[i].latitude;
      const xj: number = polygon[j].longitude;
      const yj: number = polygon[j].latitude;
      
      const intersect: boolean = 
        ((yi > point.latitude) !== (yj > point.latitude)) &&
        (point.longitude < (xj - xi) * (point.latitude - yi) / (yj - yi) + xi);
      
      if (intersect) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Calculates a bounding box around a point with a given radius.
   * 
   * @param center - Center point
   * @param radiusMeters - Radius in meters
   * @returns Bounding box as [minLat, minLng, maxLat, maxLng]
   */
  public static calculateBoundingBox(center: Point, radiusMeters: number): [number, number, number, number] {
    // Approximate degrees latitude per meter
    const metersPerDegreeLat: number = 111320;
    
    // Calculate latitude bounds
    const latDelta: number = radiusMeters / metersPerDegreeLat;
    const minLat: number = Math.max(-90, center.latitude - latDelta);
    const maxLat: number = Math.min(90, center.latitude + latDelta);
    
    // Calculate longitude bounds (longitude degrees get smaller as we move away from equator)
    const metersPerDegreeLng: number = 111320 * Math.cos(this.degreesToRadians(center.latitude));
    const lngDelta: number = radiusMeters / metersPerDegreeLng;
    const minLng: number = Math.max(-180, center.longitude - lngDelta);
    const maxLng: number = Math.min(180, center.longitude + lngDelta);
    
    return [minLat, minLng, maxLat, maxLng];
  }
}
