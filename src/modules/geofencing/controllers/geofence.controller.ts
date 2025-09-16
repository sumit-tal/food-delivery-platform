import { Controller, Get, Post, Put, Delete, Body, Param, Query, NotFoundException } from '@nestjs/common';
import { GeofenceService } from '../services/geofence.service';
import { CreateGeofenceDto } from '../dto/create-geofence.dto';
import { PointDto } from '../dto/point.dto';
import { Geofence, Point } from '../interfaces';

/**
 * Controller for managing geofences.
 */
@Controller('geofences')
export class GeofenceController {
  constructor(private readonly geofenceService: GeofenceService) {}

  /**
   * Creates a new geofence.
   * 
   * @param createGeofenceDto - Data for creating a geofence
   * @returns The created geofence
   */
  @Post()
  public createGeofence(@Body() createGeofenceDto: CreateGeofenceDto): Geofence {
    return this.geofenceService.createGeofence(createGeofenceDto);
  }

  /**
   * Gets all geofences.
   * 
   * @returns Array of all geofences
   */
  @Get()
  public getAllGeofences(): Geofence[] {
    return this.geofenceService.getAllGeofences();
  }

  /**
   * Gets a geofence by ID.
   * 
   * @param id - Geofence ID
   * @returns The geofence
   * @throws NotFoundException if the geofence is not found
   */
  @Get(':id')
  public getGeofenceById(@Param('id') id: string): Geofence {
    const geofence: Geofence | undefined = this.geofenceService.getGeofenceById(id);
    
    if (!geofence) {
      throw new NotFoundException(`Geofence with ID ${id} not found`);
    }
    
    return geofence;
  }

  /**
   * Updates a geofence.
   * 
   * @param id - Geofence ID
   * @param createGeofenceDto - Updated geofence data
   * @returns The updated geofence
   * @throws NotFoundException if the geofence is not found
   */
  @Put(':id')
  public updateGeofence(
    @Param('id') id: string,
    @Body() createGeofenceDto: CreateGeofenceDto
  ): Geofence {
    const geofence: Geofence | undefined = this.geofenceService.updateGeofence(id, createGeofenceDto);
    
    if (!geofence) {
      throw new NotFoundException(`Geofence with ID ${id} not found`);
    }
    
    return geofence;
  }

  /**
   * Deletes a geofence.
   * 
   * @param id - Geofence ID
   * @returns Success message
   * @throws NotFoundException if the geofence is not found
   */
  @Delete(':id')
  public deleteGeofence(@Param('id') id: string): { message: string } {
    const deleted: boolean = this.geofenceService.deleteGeofence(id);
    
    if (!deleted) {
      throw new NotFoundException(`Geofence with ID ${id} not found`);
    }
    
    return { message: `Geofence with ID ${id} deleted successfully` };
  }

  /**
   * Checks if a point is inside any geofence.
   * 
   * @param point - The point to check
   * @returns Array of geofences containing the point
   */
  @Post('contains')
  public checkPointInGeofences(@Body() point: PointDto): Geofence[] {
    return this.geofenceService.findGeofencesContainingPoint(point);
  }

  /**
   * Finds all geofences within a radius of a point.
   * 
   * @param lat - Latitude
   * @param lng - Longitude
   * @param radius - Radius in meters
   * @returns Array of geofences within the radius
   */
  @Get('radius')
  public findGeofencesWithinRadius(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number
  ): Geofence[] {
    const center: Point = { latitude: lat, longitude: lng };
    return this.geofenceService.findGeofencesWithinRadius(center, radius);
  }
}
