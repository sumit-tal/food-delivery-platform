/**
 * Interface for in-memory location data
 */
export interface InMemoryLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  batteryLevel?: number;
  timestamp: Date | string;
}
