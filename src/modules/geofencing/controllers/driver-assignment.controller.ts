import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import {
  DriverAssignmentService,
  Driver,
  Restaurant,
  DriverAssignmentResult,
} from '../services/driver-assignment.service';
import { Point } from '../interfaces';

/**
 * Controller for driver assignment operations.
 */
@Controller('driver-assignment')
export class DriverAssignmentController {
  constructor(private readonly driverAssignmentService: DriverAssignmentService) {}

  /**
   * Finds the best available drivers for a restaurant pickup.
   *
   * @param restaurant - Restaurant to pick up from
   * @param maxDistance - Maximum distance in meters
   * @param limit - Maximum number of drivers to return
   * @returns Array of driver assignment results, sorted by score
   */
  @Post('best-drivers')
  public findBestDriversForRestaurant(
    @Body('restaurant') restaurant: Restaurant,
    @Body('maxDistance') maxDistance: number = 5000,
    @Body('limit') limit: number = 5,
  ): DriverAssignmentResult[] {
    // This would typically call a driver service to get all drivers
    // For now, we'll return an empty array as this is just the controller interface
    const drivers: Driver[] = [];

    return this.driverAssignmentService.findBestDriversForRestaurant(
      drivers,
      restaurant,
      maxDistance,
      limit,
    );
  }

  /**
   * Assigns the best driver for an order.
   *
   * @param restaurant - Restaurant to pick up from
   * @param deliveryLocation - Delivery location
   * @returns The best driver assignment or null if no suitable driver found
   */
  @Post('assign-driver')
  public assignBestDriverForOrder(
    @Body('restaurant') restaurant: Restaurant,
    @Body('deliveryLocation') deliveryLocation: Point,
  ): DriverAssignmentResult | null {
    // This would typically call a driver service to get all drivers
    // For now, we'll return null as this is just the controller interface
    const drivers: Driver[] = [];

    return this.driverAssignmentService.assignBestDriverForOrder(
      drivers,
      restaurant,
      deliveryLocation,
    );
  }

  /**
   * Calculates the estimated delivery time for a route.
   *
   * @param driver - Driver
   * @param restaurant - Restaurant
   * @param deliveryLocation - Delivery location
   * @returns Estimated delivery time in minutes
   */
  @Post('estimate-delivery-time')
  public calculateEstimatedDeliveryTime(
    @Body('driver') driver: Driver,
    @Body('restaurant') restaurant: Restaurant,
    @Body('deliveryLocation') deliveryLocation: Point,
  ): { estimatedTimeMinutes: number } {
    const estimatedTimeMinutes: number =
      this.driverAssignmentService.calculateEstimatedDeliveryTime(
        driver,
        restaurant,
        deliveryLocation,
      );

    return { estimatedTimeMinutes };
  }

  /**
   * Gets drivers near a location.
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @param radius - Radius in meters
   * @returns Array of drivers within the radius
   */
  @Get('drivers-nearby')
  public getDriversNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number = 5000,
  ): Driver[] {
    // This would typically call a driver service to get all drivers
    // For now, we'll return an empty array as this is just the controller interface
    return [];
  }
}
