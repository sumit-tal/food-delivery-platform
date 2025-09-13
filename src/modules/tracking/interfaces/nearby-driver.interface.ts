/**
 * Interface for nearby driver data
 */
export interface NearbyDriver {
  driver_id: string;
  distance_meters: number;
  last_updated: Date;
}
