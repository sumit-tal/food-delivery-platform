/**
 * Interface for driver location data
 */
export interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  batteryLevel?: number;
  timestamp: Date | string;
  source: 'memory' | 'database';
}
