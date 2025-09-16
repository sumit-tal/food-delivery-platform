import { Controller, Post, Body, Get, Param, Delete } from '@nestjs/common';
import { GeofenceEventService, GeofenceEvent } from '../services/geofence-event.service';
import { Point } from '../interfaces';

/**
 * Controller for geofence event operations.
 */
@Controller('geofence-events')
export class GeofenceEventController {
  constructor(private readonly geofenceEventService: GeofenceEventService) {}

  /**
   * Updates the location of an entity and emits geofence events if needed.
   *
   * @param entityId - Entity ID
   * @param entityType - Entity type
   * @param location - Current location
   * @param metadata - Additional metadata
   * @returns Array of geofence events triggered by this update
   */
  @Post('update-location')
  public updateEntityLocation(
    @Body('entityId') entityId: string,
    @Body('entityType') entityType: string,
    @Body('location') location: Point,
    @Body('metadata') metadata?: Record<string, any>,
  ): GeofenceEvent[] {
    return this.geofenceEventService.updateEntityLocation(entityId, entityType, location, metadata);
  }

  /**
   * Gets the current location of an entity.
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @returns The entity location or undefined if not found
   */
  @Get('location/:entityType/:entityId')
  public getEntityLocation(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): any {
    return this.geofenceEventService.getEntityLocation(entityId, entityType);
  }

  /**
   * Gets all entities currently within a geofence.
   *
   * @param geofenceId - Geofence ID
   * @returns Array of entity locations within the geofence
   */
  @Get('in-geofence/:geofenceId')
  public getEntitiesInGeofence(@Param('geofenceId') geofenceId: string): any[] {
    return this.geofenceEventService.getEntitiesInGeofence(geofenceId);
  }

  /**
   * Clears location data for an entity.
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @returns Success message
   */
  @Delete('location/:entityType/:entityId')
  public clearEntityLocation(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): { success: boolean } {
    const result: boolean = this.geofenceEventService.clearEntityLocation(entityId, entityType);
    return { success: result };
  }
}
