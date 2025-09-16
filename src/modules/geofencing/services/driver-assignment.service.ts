import { Injectable } from '@nestjs/common';
import { Point } from '../interfaces';
import { ProximitySearchService, LocationEntity, ProximitySearchResult } from './proximity-search.service';
import { GeoUtils } from '../utils/geo.utils';

/**
 * Interface for a driver entity with location information.
 */
export interface Driver extends LocationEntity {
  readonly id: string;
  readonly name: string;
  readonly location: Point;
  readonly isAvailable: boolean;
  readonly currentOrderId?: string;
  readonly vehicleType: 'car' | 'motorcycle' | 'bicycle';
  readonly rating: number;
  readonly metadata?: Record<string, any>;
}

/**
 * Interface for a restaurant entity with location information.
 */
export interface Restaurant extends LocationEntity {
  readonly id: string;
  readonly name: string;
  readonly location: Point;
  readonly isOpen: boolean;
  readonly metadata?: Record<string, any>;
}

/**
 * Interface for driver assignment result.
 */
export interface DriverAssignmentResult {
  readonly driver: Driver;
  readonly distanceToRestaurant: number; // Distance in meters
  readonly estimatedPickupTime: number; // Time in minutes
  readonly score: number; // Assignment score (higher is better)
}

/**
 * Service for assigning drivers to orders based on proximity and other factors.
 */
@Injectable()
export class DriverAssignmentService {
  constructor(private readonly proximitySearchService: ProximitySearchService) {}

  /**
   * Finds the best available drivers for a restaurant pickup.
   * 
   * @param drivers - Array of drivers
   * @param restaurant - Restaurant to pick up from
   * @param maxDistanceMeters - Maximum distance in meters (default: 5000)
   * @param limit - Maximum number of drivers to return (default: 5)
   * @returns Array of driver assignment results, sorted by score
   */
  public findBestDriversForRestaurant(
    drivers: Driver[],
    restaurant: Restaurant,
    maxDistanceMeters: number = 5000,
    limit: number = 5
  ): DriverAssignmentResult[] {
    // Filter available drivers
    const availableDrivers: Driver[] = drivers.filter(driver => driver.isAvailable);
    
    // Find drivers within the maximum distance
    const driversWithinRadius: ProximitySearchResult<Driver>[] = 
      this.proximitySearchService.findEntitiesWithinRadius(
        availableDrivers,
        {
          location: restaurant.location,
          radius: maxDistanceMeters,
          limit: 0 // No limit here, we'll apply scoring and limit later
        }
      );
    
    // Calculate scores and create assignment results
    const assignmentResults: DriverAssignmentResult[] = driversWithinRadius.map(result => {
      const driver: Driver = result.entity;
      const distanceToRestaurant: number = result.distance;
      
      // Estimate pickup time (1 minute per 500 meters + 2 minutes buffer)
      const estimatedPickupTime: number = Math.ceil(distanceToRestaurant / 500) + 2;
      
      // Calculate score based on multiple factors
      // - Distance: Closer is better (inverse relationship)
      // - Rating: Higher is better
      // - Vehicle type: Faster vehicles are better for longer distances
      
      // Distance score (0-100, inverse to distance)
      const distanceScore: number = Math.max(0, 100 - (distanceToRestaurant / 50));
      
      // Rating score (0-100, directly proportional to rating)
      const ratingScore: number = driver.rating * 20; // Assuming rating is 0-5
      
      // Vehicle type score (0-100, based on vehicle speed)
      let vehicleTypeScore: number = 0;
      switch (driver.vehicleType) {
        case 'car':
          vehicleTypeScore = 80;
          break;
        case 'motorcycle':
          vehicleTypeScore = 100; // Motorcycles are best for food delivery
          break;
        case 'bicycle':
          // Bicycles are good for short distances but bad for long distances
          vehicleTypeScore = Math.max(0, 100 - (distanceToRestaurant / 100));
          break;
      }
      
      // Final score (weighted average)
      const score: number = (
        (distanceScore * 0.5) + // Distance is most important
        (ratingScore * 0.3) +   // Rating is second most important
        (vehicleTypeScore * 0.2) // Vehicle type is least important
      );
      
      return {
        driver,
        distanceToRestaurant,
        estimatedPickupTime,
        score
      };
    });
    
    // Sort by score (descending)
    assignmentResults.sort((a, b) => b.score - a.score);
    
    // Apply limit
    return assignmentResults.slice(0, limit);
  }

  /**
   * Assigns the best driver for an order.
   * 
   * @param drivers - Array of drivers
   * @param restaurant - Restaurant to pick up from
   * @param deliveryLocation - Delivery location
   * @returns The best driver assignment or null if no suitable driver found
   */
  public assignBestDriverForOrder(
    drivers: Driver[],
    restaurant: Restaurant,
    deliveryLocation: Point
  ): DriverAssignmentResult | null {
    // Find the best drivers for the restaurant
    const bestDrivers: DriverAssignmentResult[] = this.findBestDriversForRestaurant(
      drivers,
      restaurant
    );
    
    if (bestDrivers.length === 0) {
      return null;
    }
    
    // Calculate full route distance for each driver
    const driversWithFullRoute: (DriverAssignmentResult & { fullRouteDistance: number })[] = 
      bestDrivers.map(result => {
        // Calculate distance from restaurant to delivery location
        const restaurantToDeliveryDistance: number = GeoUtils.calculateDistance(
          restaurant.location,
          deliveryLocation
        );
        
        // Calculate full route distance (driver -> restaurant -> delivery)
        const fullRouteDistance: number = result.distanceToRestaurant + restaurantToDeliveryDistance;
        
        return {
          ...result,
          fullRouteDistance
        };
      });
    
    // Sort by full route distance (ascending)
    driversWithFullRoute.sort((a, b) => a.fullRouteDistance - b.fullRouteDistance);
    
    // Return the best driver
    return driversWithFullRoute[0];
  }

  /**
   * Calculates the estimated delivery time for a route.
   * 
   * @param driver - Driver
   * @param restaurant - Restaurant
   * @param deliveryLocation - Delivery location
   * @returns Estimated delivery time in minutes
   */
  public calculateEstimatedDeliveryTime(
    driver: Driver,
    restaurant: Restaurant,
    deliveryLocation: Point
  ): number {
    // Calculate distances
    const driverToRestaurantDistance: number = GeoUtils.calculateDistance(
      driver.location,
      restaurant.location
    );
    
    const restaurantToDeliveryDistance: number = GeoUtils.calculateDistance(
      restaurant.location,
      deliveryLocation
    );
    
    // Calculate times based on vehicle type
    let speedMetersPerMinute: number = 0;
    switch (driver.vehicleType) {
      case 'car':
        speedMetersPerMinute = 500; // 30 km/h
        break;
      case 'motorcycle':
        speedMetersPerMinute = 400; // 24 km/h
        break;
      case 'bicycle':
        speedMetersPerMinute = 250; // 15 km/h
        break;
    }
    
    // Calculate time components
    const timeToRestaurant: number = driverToRestaurantDistance / speedMetersPerMinute;
    const timeToDelivery: number = restaurantToDeliveryDistance / speedMetersPerMinute;
    
    // Add buffer times
    const pickupBufferMinutes: number = 5; // Time at restaurant
    const deliveryBufferMinutes: number = 3; // Time at delivery location
    
    // Total estimated time
    const totalTimeMinutes: number = 
      timeToRestaurant + 
      pickupBufferMinutes + 
      timeToDelivery + 
      deliveryBufferMinutes;
    
    return Math.ceil(totalTimeMinutes);
  }
}
