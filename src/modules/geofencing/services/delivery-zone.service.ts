import { Injectable } from '@nestjs/common';
import { Geofence, Point } from '../interfaces';
import { GeofenceService } from './geofence.service';
import { GeoUtils } from '../utils/geo.utils';

/**
 * Interface for a delivery zone with associated metadata.
 */
export interface DeliveryZone {
  readonly id: string;
  readonly name: string;
  readonly geofence: Geofence;
  readonly estimatedDeliveryTimeMinutes: number;
  readonly deliveryFee: number;
  readonly isActive: boolean;
  readonly metadata?: Record<string, any>;
}

/**
 * Service for managing delivery zones based on geofences.
 */
@Injectable()
export class DeliveryZoneService {
  private readonly deliveryZones: Map<string, DeliveryZone>;

  constructor(private readonly geofenceService: GeofenceService) {
    this.deliveryZones = new Map<string, DeliveryZone>();
  }

  /**
   * Creates a new delivery zone.
   * 
   * @param deliveryZone - Delivery zone data
   * @returns The created delivery zone
   */
  public createDeliveryZone(deliveryZone: DeliveryZone): DeliveryZone {
    this.deliveryZones.set(deliveryZone.id, deliveryZone);
    return deliveryZone;
  }

  /**
   * Gets a delivery zone by ID.
   * 
   * @param id - Delivery zone ID
   * @returns The delivery zone if found, undefined otherwise
   */
  public getDeliveryZoneById(id: string): DeliveryZone | undefined {
    return this.deliveryZones.get(id);
  }

  /**
   * Gets all delivery zones.
   * 
   * @returns Array of all delivery zones
   */
  public getAllDeliveryZones(): DeliveryZone[] {
    return Array.from(this.deliveryZones.values());
  }

  /**
   * Gets all active delivery zones.
   * 
   * @returns Array of active delivery zones
   */
  public getActiveDeliveryZones(): DeliveryZone[] {
    return Array.from(this.deliveryZones.values()).filter(zone => zone.isActive);
  }

  /**
   * Finds delivery zones that contain a point.
   * 
   * @param point - The point to check
   * @returns Array of delivery zones containing the point
   */
  public findDeliveryZonesContainingPoint(point: Point): DeliveryZone[] {
    const geofences: Geofence[] = this.geofenceService.findGeofencesContainingPoint(point);
    
    return this.getActiveDeliveryZones().filter(zone => 
      geofences.some(geofence => geofence.id === zone.geofence.id)
    );
  }

  /**
   * Finds delivery zones within a radius of a point.
   * 
   * @param center - Center point for the search
   * @param radiusMeters - Search radius in meters
   * @returns Array of delivery zones within the radius
   */
  public findDeliveryZonesWithinRadius(center: Point, radiusMeters: number): DeliveryZone[] {
    const geofences: Geofence[] = this.geofenceService.findGeofencesWithinRadius(center, radiusMeters);
    
    return this.getActiveDeliveryZones().filter(zone => 
      geofences.some(geofence => geofence.id === zone.geofence.id)
    );
  }

  /**
   * Updates a delivery zone.
   * 
   * @param id - Delivery zone ID
   * @param deliveryZone - Updated delivery zone data
   * @returns The updated delivery zone if found, undefined otherwise
   */
  public updateDeliveryZone(id: string, deliveryZone: DeliveryZone): DeliveryZone | undefined {
    if (!this.deliveryZones.has(id)) {
      return undefined;
    }
    
    this.deliveryZones.set(id, deliveryZone);
    return deliveryZone;
  }

  /**
   * Deletes a delivery zone.
   * 
   * @param id - Delivery zone ID
   * @returns True if the delivery zone was deleted, false if it wasn't found
   */
  public deleteDeliveryZone(id: string): boolean {
    return this.deliveryZones.delete(id);
  }

  /**
   * Calculates the estimated delivery time for a route between two points.
   * 
   * @param origin - Origin point
   * @param destination - Destination point
   * @returns Estimated delivery time in minutes
   */
  public calculateEstimatedDeliveryTime(origin: Point, destination: Point): number {
    // Calculate distance in meters
    const distanceMeters: number = GeoUtils.calculateDistance(origin, destination);
    
    // Assume average speed of 30 km/h (500 meters per minute)
    const averageSpeedMetersPerMinute: number = 500;
    
    // Base time in minutes
    const baseTimeMinutes: number = distanceMeters / averageSpeedMetersPerMinute;
    
    // Add buffer time (e.g., traffic, pickup time)
    const bufferMinutes: number = 10;
    
    return Math.ceil(baseTimeMinutes + bufferMinutes);
  }

  /**
   * Calculates the delivery fee based on distance and zone.
   * 
   * @param origin - Origin point
   * @param destination - Destination point
   * @returns Delivery fee
   */
  public calculateDeliveryFee(origin: Point, destination: Point): number {
    // Calculate distance in meters
    const distanceMeters: number = GeoUtils.calculateDistance(origin, destination);
    
    // Base fee
    const baseFee: number = 2.99;
    
    // Distance fee (per km)
    const distanceFeePerKm: number = 1.5;
    const distanceFee: number = (distanceMeters / 1000) * distanceFeePerKm;
    
    return Math.round((baseFee + distanceFee) * 100) / 100;
  }
}
