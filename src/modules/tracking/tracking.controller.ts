import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  ParseUUIDPipe,
  ParseFloatPipe,
  ParseIntPipe,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TrackingService } from './tracking.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { DriverLocation, NearbyDriver, OrderTracking } from './interfaces';

/**
 * Controller for driver tracking endpoints
 */
@Controller('tracking')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(private readonly trackingService: TrackingService) {}

  /**
   * Update driver location via HTTP (fallback for WebSocket)
   */
  @Post('location')
  @UseGuards(JwtAuthGuard)
  async updateLocation(
    @Body() locationUpdate: LocationUpdateDto,
  ): Promise<{ success: boolean; id: string }> {
    this.logger.debug(`Received location update for driver ${locationUpdate.driverId}`);
    const locationId = await this.trackingService.processLocationUpdate(locationUpdate);
    return { success: true, id: locationId };
  }

  /**
   * Special endpoint for simulator location updates that doesn't require authentication
   * This endpoint is only for local development and testing
   */
  @Post('simulator/location')
  async updateSimulatorLocation(
    @Body() locationUpdates: LocationUpdateDto | LocationUpdateDto[],
    @Headers('x-simulator-key') simulatorKey: string,
  ): Promise<{ success: boolean; count: number }> {
    // Simple API key validation to prevent unauthorized access
    const validSimulatorKey = process.env.SIMULATOR_API_KEY || 'simulator-local-dev';

    if (simulatorKey !== validSimulatorKey) {
      this.logger.warn('Invalid simulator key used for location update');
      return { success: false, count: 0 };
    }

    // Handle both single updates and batch updates
    const updates = Array.isArray(locationUpdates) ? locationUpdates : [locationUpdates];

    this.logger.debug(`Received ${updates.length} simulator location updates`);

    // Process each location update
    for (const update of updates) {
      await this.trackingService.processLocationUpdate(update);
    }

    return { success: true, count: updates.length };
  }

  /**
   * Get the latest location for a driver
   */
  @Get('driver/:driverId/location')
  @UseGuards(JwtAuthGuard)
  async getDriverLocation(@Param('driverId', ParseUUIDPipe) driverId: string): Promise<DriverLocation> {
    return this.trackingService.getDriverLocation(driverId);
  }

  /**
   * Get location history for a driver
   */
  @Get('driver/:driverId/history')
  @UseGuards(JwtAuthGuard)
  async getDriverHistory(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('limit', ParseIntPipe) limit: number = 100,
  ): Promise<DriverLocation[]> {
    const startTime = start ? new Date(start) : new Date(Date.now() - 3600000); // Default to last hour
    const endTime = end ? new Date(end) : new Date();

    return this.trackingService.getDriverLocationHistory(driverId, startTime, endTime, limit);
  }

  /**
   * Find nearby drivers
   */
  @Get('nearby')
  @UseGuards(JwtAuthGuard)
  async findNearbyDrivers(
    @Query('lat', ParseFloatPipe) latitude: number,
    @Query('lng', ParseFloatPipe) longitude: number,
    @Query('radius', ParseIntPipe) radiusMeters: number = 5000,
    @Query('limit', ParseIntPipe) limit: number = 10,
  ): Promise<NearbyDriver[]> {
    return this.trackingService.findNearbyDrivers(latitude, longitude, radiusMeters, limit);
  }

  /**
   * Get tracking information for an order
   */
  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  async getOrderTracking(@Param('orderId', ParseUUIDPipe) orderId: string): Promise<OrderTracking> {
    return this.trackingService.getOrderTracking(orderId);
  }

  /**
   * Health check endpoint for the tracking service
   */
  @Get('health')
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
