/**
 * Interface for database location data
 */
export interface DbLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  battery_level?: number;
  timestamp: Date;
}
