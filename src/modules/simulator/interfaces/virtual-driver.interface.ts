import { GeoPoint } from './geo-point.interface';

/**
 * Interface for virtual driver in the simulator
 */
export interface VirtualDriver {
  /**
   * Unique identifier for the driver
   */
  readonly id: string;
  
  /**
   * Current latitude
   */
  latitude: number;
  
  /**
   * Current longitude
   */
  longitude: number;
  
  /**
   * Current heading in degrees (0-360, 0 = North)
   */
  heading: number;
  
  /**
   * Current speed in km/h
   */
  speed: number;
  
  /**
   * GPS accuracy in meters
   */
  accuracy: number;
  
  /**
   * Battery level percentage (0-100)
   */
  batteryLevel: number;
  
  /**
   * Driver status (available, en_route, busy, offline)
   */
  status: string;
  
  /**
   * Current destination if any
   */
  destination: GeoPoint | null;
  
  /**
   * Route to follow if destination is set
   */
  route: GeoPoint[];
  
  /**
   * Current index in the route
   */
  currentRouteIndex: number;
}
