import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SimulatorConfig, VirtualDriver } from '../interfaces';
import { LocationUpdateDto } from '../../tracking/dto/location-update.dto';
import { MovementPatternService } from './movement-pattern.service';
import { ConfigService } from '@nestjs/config';

/**
 * Service responsible for simulating driver behavior
 */
@Injectable()
export class DriverSimulatorService {
  private readonly logger = new Logger(DriverSimulatorService.name);
  private drivers: VirtualDriver[] = [];
  private config: SimulatorConfig = {
    driverCount: 10,
    updateFrequencyMs: 1000,
    autoStart: false,
    initialRegion: {
      centerLat: 37.7749,
      centerLng: -122.4194,
      radiusKm: 5,
    },
  };

  private readonly apiEndpoint: string;
  private readonly simulatorApiKey: string;

  constructor(
    private readonly movementPatternService: MovementPatternService,
    private readonly configService: ConfigService,
  ) {
    this.apiEndpoint = this.configService.get<string>(
      'LOCATION_UPDATE_ENDPOINT',
      'http://localhost:3000/api/tracking/simulator/location',
    );
    this.simulatorApiKey = this.configService.get<string>(
      'SIMULATOR_API_KEY',
      'simulator-local-dev',
    );
  }

  /**
   * Initialize the driver simulator with the provided configuration
   */
  initialize(config: SimulatorConfig): void {
    this.config = config;
    this.createVirtualDrivers();
  }

  /**
   * Create virtual drivers based on the configuration
   */
  private createVirtualDrivers(): void {
    // Clear existing drivers
    this.drivers = [];

    const { driverCount, initialRegion } = this.config;

    for (let i = 0; i < driverCount; i++) {
      this.drivers.push(this.createSingleDriver(initialRegion));
    }

    this.logger.log(`Created ${driverCount} virtual drivers`);
  }

  /**
   * Create a single virtual driver
   */
  private createSingleDriver(region: {
    centerLat: number;
    centerLng: number;
    radiusKm: number;
  }): VirtualDriver {
    // Generate random position within the region
    const { latitude, longitude } = this.movementPatternService.getRandomPositionInRegion(
      region.centerLat,
      region.centerLng,
      region.radiusKm,
    );

    // Create a new virtual driver
    return {
      id: uuidv4(),
      latitude,
      longitude,
      heading: Math.random() * 360, // Random initial heading
      speed: 0, // Start stationary
      batteryLevel: 75 + Math.random() * 25, // Random battery level between 75-100%
      accuracy: 5 + Math.random() * 10, // Random accuracy between 5-15 meters
      status: 'available',
      destination: null,
      route: [],
      currentRouteIndex: 0,
    };
  }

  /**
   * Update the locations of all virtual drivers
   */
  updateDriverLocations(): void {
    const updates: LocationUpdateDto[] = [];

    for (const driver of this.drivers) {
      // Update driver position based on movement pattern
      this.movementPatternService.updateDriverPosition(driver);

      // Create location update DTO
      const update: LocationUpdateDto = {
        driverId: driver.id,
        latitude: driver.latitude,
        longitude: driver.longitude,
        heading: driver.heading,
        speed: driver.speed,
        accuracy: driver.accuracy,
        batteryLevel: driver.batteryLevel,
      };

      updates.push(update);
    }

    // Send updates to the tracking system
    this.sendLocationUpdates(updates);
  }

  /**
   * Send location updates to the tracking system
   */
  sendLocationUpdates(updates: LocationUpdateDto[]): void {
    if (updates.length === 0) return;

    try {
      // For development purposes, just log the updates
      this.logger.debug(`Simulated sending ${updates.length} location updates`);

      // Log a sample of the updates for debugging
      if (updates.length > 0) {
        this.logger.debug(`Sample update: ${JSON.stringify(updates[0])}`);
      }

      // In a real implementation, we would send the updates to the tracking system
      // using fetch API or another HTTP client
    } catch (error) {
      this.logger.error(
        `Failed to process location updates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get the number of active drivers
   */
  getActiveDriverCount(): number {
    return this.drivers.length;
  }

  /**
   * Get all virtual drivers
   */
  getAllDrivers(): VirtualDriver[] {
    return [...this.drivers];
  }

  /**
   * Get a specific driver by ID
   */
  getDriverById(driverId: string): VirtualDriver | undefined {
    return this.drivers.find((driver) => driver.id === driverId);
  }

  /**
   * Set a destination for a specific driver
   */
  setDriverDestination(driverId: string, latitude: number, longitude: number): boolean {
    const driver = this.getDriverById(driverId);
    if (!driver) {
      return false;
    }

    // Set destination and generate route
    driver.destination = { latitude, longitude };
    driver.route = this.movementPatternService.generateRoute(
      driver.latitude,
      driver.longitude,
      latitude,
      longitude,
    );
    driver.currentRouteIndex = 0;
    driver.status = 'en_route';

    return true;
  }
}
