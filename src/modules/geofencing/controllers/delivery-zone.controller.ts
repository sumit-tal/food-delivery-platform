import { Controller, Get, Post, Put, Delete, Body, Param, Query, NotFoundException } from '@nestjs/common';
import { DeliveryZoneService, DeliveryZone } from '../services/delivery-zone.service';
import { Point } from '../interfaces';

/**
 * Controller for managing delivery zones.
 */
@Controller('delivery-zones')
export class DeliveryZoneController {
  constructor(private readonly deliveryZoneService: DeliveryZoneService) {}

  /**
   * Creates a new delivery zone.
   * 
   * @param deliveryZone - Delivery zone data
   * @returns The created delivery zone
   */
  @Post()
  public createDeliveryZone(@Body() deliveryZone: DeliveryZone): DeliveryZone {
    return this.deliveryZoneService.createDeliveryZone(deliveryZone);
  }

  /**
   * Gets all delivery zones.
   * 
   * @returns Array of all delivery zones
   */
  @Get()
  public getAllDeliveryZones(): DeliveryZone[] {
    return this.deliveryZoneService.getAllDeliveryZones();
  }

  /**
   * Gets all active delivery zones.
   * 
   * @returns Array of active delivery zones
   */
  @Get('active')
  public getActiveDeliveryZones(): DeliveryZone[] {
    return this.deliveryZoneService.getActiveDeliveryZones();
  }

  /**
   * Gets a delivery zone by ID.
   * 
   * @param id - Delivery zone ID
   * @returns The delivery zone
   * @throws NotFoundException if the delivery zone is not found
   */
  @Get(':id')
  public getDeliveryZoneById(@Param('id') id: string): DeliveryZone {
    const deliveryZone: DeliveryZone | undefined = this.deliveryZoneService.getDeliveryZoneById(id);
    
    if (!deliveryZone) {
      throw new NotFoundException(`Delivery zone with ID ${id} not found`);
    }
    
    return deliveryZone;
  }

  /**
   * Updates a delivery zone.
   * 
   * @param id - Delivery zone ID
   * @param deliveryZone - Updated delivery zone data
   * @returns The updated delivery zone
   * @throws NotFoundException if the delivery zone is not found
   */
  @Put(':id')
  public updateDeliveryZone(
    @Param('id') id: string,
    @Body() deliveryZone: DeliveryZone
  ): DeliveryZone {
    const updatedDeliveryZone: DeliveryZone | undefined = 
      this.deliveryZoneService.updateDeliveryZone(id, deliveryZone);
    
    if (!updatedDeliveryZone) {
      throw new NotFoundException(`Delivery zone with ID ${id} not found`);
    }
    
    return updatedDeliveryZone;
  }

  /**
   * Deletes a delivery zone.
   * 
   * @param id - Delivery zone ID
   * @returns Success message
   * @throws NotFoundException if the delivery zone is not found
   */
  @Delete(':id')
  public deleteDeliveryZone(@Param('id') id: string): { message: string } {
    const deleted: boolean = this.deliveryZoneService.deleteDeliveryZone(id);
    
    if (!deleted) {
      throw new NotFoundException(`Delivery zone with ID ${id} not found`);
    }
    
    return { message: `Delivery zone with ID ${id} deleted successfully` };
  }

  /**
   * Finds delivery zones that contain a point.
   * 
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Array of delivery zones containing the point
   */
  @Get('contains')
  public findDeliveryZonesContainingPoint(
    @Query('lat') lat: number,
    @Query('lng') lng: number
  ): DeliveryZone[] {
    const point: Point = { latitude: lat, longitude: lng };
    return this.deliveryZoneService.findDeliveryZonesContainingPoint(point);
  }

  /**
   * Finds delivery zones within a radius of a point.
   * 
   * @param lat - Latitude
   * @param lng - Longitude
   * @param radius - Radius in meters
   * @returns Array of delivery zones within the radius
   */
  @Get('radius')
  public findDeliveryZonesWithinRadius(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number
  ): DeliveryZone[] {
    const center: Point = { latitude: lat, longitude: lng };
    return this.deliveryZoneService.findDeliveryZonesWithinRadius(center, radius);
  }

  /**
   * Calculates the estimated delivery time for a route.
   * 
   * @param originLat - Origin latitude
   * @param originLng - Origin longitude
   * @param destLat - Destination latitude
   * @param destLng - Destination longitude
   * @returns Estimated delivery time in minutes
   */
  @Get('estimate-time')
  public calculateEstimatedDeliveryTime(
    @Query('originLat') originLat: number,
    @Query('originLng') originLng: number,
    @Query('destLat') destLat: number,
    @Query('destLng') destLng: number
  ): { estimatedTimeMinutes: number } {
    const origin: Point = { latitude: originLat, longitude: originLng };
    const destination: Point = { latitude: destLat, longitude: destLng };
    
    const estimatedTimeMinutes: number = 
      this.deliveryZoneService.calculateEstimatedDeliveryTime(origin, destination);
    
    return { estimatedTimeMinutes };
  }

  /**
   * Calculates the delivery fee for a route.
   * 
   * @param originLat - Origin latitude
   * @param originLng - Origin longitude
   * @param destLat - Destination latitude
   * @param destLng - Destination longitude
   * @returns Delivery fee
   */
  @Get('calculate-fee')
  public calculateDeliveryFee(
    @Query('originLat') originLat: number,
    @Query('originLng') originLng: number,
    @Query('destLat') destLat: number,
    @Query('destLng') destLng: number
  ): { deliveryFee: number } {
    const origin: Point = { latitude: originLat, longitude: originLng };
    const destination: Point = { latitude: destLat, longitude: destLng };
    
    const deliveryFee: number = 
      this.deliveryZoneService.calculateDeliveryFee(origin, destination);
    
    return { deliveryFee };
  }
}
