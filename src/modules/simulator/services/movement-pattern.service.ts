import { Injectable, Logger } from '@nestjs/common';
import { VirtualDriver, GeoPoint } from '../interfaces';

/**
 * Service responsible for generating realistic movement patterns for virtual drivers
 */
@Injectable()
export class MovementPatternService {
  private readonly logger = new Logger(MovementPatternService.name);
  
  // Earth radius in kilometers
  private readonly EARTH_RADIUS_KM = 6371;
  
  // Movement constants
  private readonly MAX_SPEED_KMH = 60; // Maximum speed in km/h
  private readonly MIN_SPEED_KMH = 0; // Minimum speed in km/h
  private readonly ACCELERATION_RATE = 5; // km/h per update
  private readonly DECELERATION_RATE = 8; // km/h per update
  private readonly TURN_RATE_MAX = 30; // Maximum degrees per update
  private readonly STOP_PROBABILITY = 0.01; // Probability of stopping at an update
  private readonly ROUTE_SEGMENT_LENGTH = 0.2; // km

  /**
   * Generate a random position within a circular region
   */
  getRandomPositionInRegion(
    centerLat: number, 
    centerLng: number, 
    radiusKm: number
  ): GeoPoint {
    // Generate a random distance within the radius
    const r = radiusKm * Math.sqrt(Math.random());
    
    // Generate a random angle
    const theta = Math.random() * 2 * Math.PI;
    
    // Convert to cartesian coordinates
    const dx = r * Math.cos(theta);
    const dy = r * Math.sin(theta);
    
    // Convert to latitude/longitude
    const latOffset = (dy / this.EARTH_RADIUS_KM) * (180 / Math.PI);
    const lngOffset = (dx / (this.EARTH_RADIUS_KM * Math.cos(centerLat * Math.PI / 180))) * (180 / Math.PI);
    
    return {
      latitude: centerLat + latOffset,
      longitude: centerLng + lngOffset,
    };
  }

  /**
   * Update driver position based on current state and movement pattern
   */
  updateDriverPosition(driver: VirtualDriver): void {
    // If driver has a destination and route, follow the route
    if (driver.destination && driver.route.length > 0) {
      this.followRoute(driver);
      return;
    }
    
    // Random movement pattern
    this.randomMovement(driver);
  }

  /**
   * Move driver along a predefined route
   */
  private followRoute(driver: VirtualDriver): void {
    if (!driver.route || driver.route.length === 0) {
      return;
    }
    
    const nextWaypoint = driver.route[driver.currentRouteIndex];
    const distance = this.getDistanceToWaypoint(driver, nextWaypoint);
    const bearing = this.getBearingToWaypoint(driver, nextWaypoint);
    
    this.adjustHeading(driver, bearing);
    this.adjustSpeedForWaypoint(driver, distance);
    this.moveDriver(driver);
    this.checkWaypointReached(driver, distance);
  }
  
  /**
   * Calculate distance to waypoint
   */
  private getDistanceToWaypoint(driver: VirtualDriver, waypoint: GeoPoint): number {
    return this.calculateDistance(
      driver.latitude,
      driver.longitude,
      waypoint.latitude,
      waypoint.longitude
    );
  }
  
  /**
   * Calculate bearing to waypoint
   */
  private getBearingToWaypoint(driver: VirtualDriver, waypoint: GeoPoint): number {
    return this.calculateBearing(
      driver.latitude,
      driver.longitude,
      waypoint.latitude,
      waypoint.longitude
    );
  }
  
  /**
   * Adjust speed based on distance to waypoint
   */
  private adjustSpeedForWaypoint(driver: VirtualDriver, distance: number): void {
    if (distance < 0.1) { // Within 100 meters of waypoint
      driver.speed = Math.max(driver.speed - this.DECELERATION_RATE, this.MIN_SPEED_KMH);
    } else {
      driver.speed = Math.min(driver.speed + this.ACCELERATION_RATE, this.MAX_SPEED_KMH);
    }
  }
  
  /**
   * Check if we've reached the waypoint and update route accordingly
   */
  private checkWaypointReached(driver: VirtualDriver, distance: number): void {
    if (distance < 0.02) { // Within 20 meters
      driver.currentRouteIndex++;
      
      // If we've reached the end of the route
      if (driver.currentRouteIndex >= driver.route.length) {
        driver.destination = null;
        driver.route = [];
        driver.status = 'available';
        driver.speed = 0;
      }
    }
  }

  /**
   * Random movement pattern for drivers without a destination
   */
  private randomMovement(driver: VirtualDriver): void {
    // Random chance of changing direction
    if (Math.random() < 0.1) {
      driver.heading += (Math.random() - 0.5) * 2 * this.TURN_RATE_MAX;
      driver.heading = (driver.heading + 360) % 360; // Normalize to 0-360
    }
    
    // Random chance of stopping or starting
    if (driver.speed === 0) {
      // If stopped, chance to start moving
      if (Math.random() < 0.3) {
        driver.speed = this.ACCELERATION_RATE;
      }
    } else if (Math.random() < this.STOP_PROBABILITY) {
      // If moving, small chance to stop
      driver.speed = 0;
    } else {
      // Random acceleration/deceleration
      const speedChange = (Math.random() - 0.5) * 2 * this.ACCELERATION_RATE;
      driver.speed = Math.max(this.MIN_SPEED_KMH, Math.min(this.MAX_SPEED_KMH, driver.speed + speedChange));
    }
    
    // Move driver
    this.moveDriver(driver);
    
    // Randomly update battery level (slight decrease)
    if (Math.random() < 0.1) {
      driver.batteryLevel = Math.max(10, driver.batteryLevel - Math.random() * 0.5);
    }
  }

  /**
   * Move driver based on current speed and heading
   */
  private moveDriver(driver: VirtualDriver): void {
    // Convert speed from km/h to km/update (assuming 1 second update)
    const speedKmPerUpdate = driver.speed / 3600;
    
    // Calculate new position
    const { latitude, longitude } = this.calculateNewPosition(
      driver.latitude,
      driver.longitude,
      driver.heading,
      speedKmPerUpdate
    );
    
    driver.latitude = latitude;
    driver.longitude = longitude;
  }

  /**
   * Calculate new position based on current position, heading, and distance
   */
  private calculateNewPosition(
    lat: number, 
    lng: number, 
    heading: number, 
    distanceKm: number
  ): GeoPoint {
    const { latRad, lngRad, headingRad } = this.convertToRadians(lat, lng, heading);
    const angularDistance = distanceKm / this.EARTH_RADIUS_KM;
    
    const newLatRad = this.calculateNewLatitude(latRad, headingRad, angularDistance);
    const newLngRad = this.calculateNewLongitude(latRad, lngRad, headingRad, angularDistance, newLatRad);
    
    return this.convertToDegrees(newLatRad, newLngRad);
  }
  
  /**
   * Convert degrees to radians
   */
  private convertToRadians(lat: number, lng: number, heading: number): { latRad: number; lngRad: number; headingRad: number } {
    return {
      latRad: lat * Math.PI / 180,
      lngRad: lng * Math.PI / 180,
      headingRad: heading * Math.PI / 180
    };
  }
  
  /**
   * Calculate new latitude in radians
   */
  private calculateNewLatitude(latRad: number, headingRad: number, angularDistance: number): number {
    return Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) + 
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(headingRad)
    );
  }
  
  /**
   * Calculate new longitude in radians
   */
  private calculateNewLongitude(
    latRad: number, 
    lngRad: number, 
    headingRad: number, 
    angularDistance: number,
    newLatRad: number
  ): number {
    return lngRad + Math.atan2(
      Math.sin(headingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );
  }
  
  /**
   * Convert radians to degrees
   */
  private convertToDegrees(latRad: number, lngRad: number): GeoPoint {
    return { 
      latitude: latRad * 180 / Math.PI, 
      longitude: lngRad * 180 / Math.PI 
    };
  }

  /**
   * Calculate distance between two points in kilometers
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Convert to radians
    const lat1Rad = lat1 * Math.PI / 180;
    const lng1Rad = lng1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const lng2Rad = lng2 * Math.PI / 180;
    
    // Haversine formula
    const dLat = lat2Rad - lat1Rad;
    const dLng = lng2Rad - lng1Rad;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return this.EARTH_RADIUS_KM * c;
  }

  /**
   * Calculate bearing between two points in degrees
   */
  private calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Convert to radians
    const lat1Rad = lat1 * Math.PI / 180;
    const lng1Rad = lng1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const lng2Rad = lng2 * Math.PI / 180;
    
    // Calculate bearing
    const y = Math.sin(lng2Rad - lng1Rad) * Math.cos(lat2Rad);
    const x = 
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lng2Rad - lng1Rad);
    const bearingRad = Math.atan2(y, x);
    
    // Convert to degrees and normalize to 0-360
    let bearingDeg = bearingRad * 180 / Math.PI;
    bearingDeg = (bearingDeg + 360) % 360;
    
    return bearingDeg;
  }

  /**
   * Adjust driver heading towards target bearing
   */
  private adjustHeading(driver: VirtualDriver, targetBearing: number): void {
    // Calculate difference between current heading and target bearing
    let diff = targetBearing - driver.heading;
    
    // Normalize to -180 to 180
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    // Limit turn rate
    const turn = Math.max(-this.TURN_RATE_MAX, Math.min(this.TURN_RATE_MAX, diff));
    
    // Update heading
    driver.heading = (driver.heading + turn + 360) % 360;
  }

  /**
   * Generate a route between two points
   */
  generateRoute(startLat: number, startLng: number, endLat: number, endLng: number): GeoPoint[] {
    const route: GeoPoint[] = [];
    
    // Calculate total distance
    const totalDistance = this.calculateDistance(startLat, startLng, endLat, endLng);
    
    // Calculate number of segments
    const numSegments = Math.max(1, Math.ceil(totalDistance / this.ROUTE_SEGMENT_LENGTH));
    
    // Generate waypoints along the route
    for (let i = 1; i <= numSegments; i++) {
      const fraction = i / numSegments;
      
      // Simple linear interpolation between start and end points
      // In a real system, this would use a routing service like Google Maps or OpenStreetMap
      const lat = startLat + fraction * (endLat - startLat);
      const lng = startLng + fraction * (endLng - startLng);
      
      // Add some randomness to simulate real roads (not straight lines)
      const jitterFactor = 0.0005; // About 50m at most
      const jitterLat = (Math.random() - 0.5) * jitterFactor;
      const jitterLng = (Math.random() - 0.5) * jitterFactor;
      
      route.push({
        latitude: lat + jitterLat,
        longitude: lng + jitterLng,
      });
    }
    
    // Add the exact destination as the final waypoint
    route.push({ latitude: endLat, longitude: endLng });
    
    return route;
  }
}
