import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DriverSimulatorService } from './driver-simulator.service';
import { SimulatorConfig } from '../interfaces/simulator-config.interface';

/**
 * Main service for managing driver simulation
 */
@Injectable()
export class SimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimulatorService.name);
  private isRunning = false;
  private simulationInterval: NodeJS.Timeout | null = null;
  private config: SimulatorConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly driverSimulatorService: DriverSimulatorService,
  ) {
    // Default configuration
    this.config = {
      driverCount: this.configService.get<number>('SIMULATOR_DRIVER_COUNT', 10),
      updateFrequencyMs: this.configService.get<number>('SIMULATOR_UPDATE_FREQUENCY_MS', 1000),
      autoStart: this.configService.get<boolean>('SIMULATOR_AUTO_START', false),
      initialRegion: {
        centerLat: this.configService.get<number>('SIMULATOR_CENTER_LAT', 37.7749),
        centerLng: this.configService.get<number>('SIMULATOR_CENTER_LNG', -122.4194),
        radiusKm: this.configService.get<number>('SIMULATOR_RADIUS_KM', 5),
      },
    };
  }

  /**
   * Initialize the simulator when the module starts
   */
  onModuleInit(): void {
    this.logger.log('Initializing driver simulator...');
    this.driverSimulatorService.initialize(this.config);

    if (this.config.autoStart) {
      this.startSimulation();
    }
  }

  /**
   * Clean up resources when the module is destroyed
   */
  onModuleDestroy(): void {
    this.stopSimulation();
  }

  /**
   * Start the simulation
   */
  startSimulation(): void {
    if (this.isRunning) {
      this.logger.warn('Simulation is already running');
      return;
    }

    try {
      this.isRunning = true;
      this.logger.log(`Starting simulation with ${this.config.driverCount} drivers`);

      // Start the simulation loop
      const updateInterval = this.config.updateFrequencyMs;
      this.simulationInterval = setInterval(() => {
        this.driverSimulatorService.updateDriverLocations();
      }, updateInterval);

      this.logger.log(`Simulation started with update frequency of ${updateInterval}ms`);
    } catch (error) {
      this.isRunning = false;
      this.logger.error(`Failed to start simulation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Stop the simulation
   */
  stopSimulation(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.isRunning = false;
    this.logger.log('Simulation stopped');
  }

  /**
   * Update the simulator configuration
   */
  updateConfig(config: Partial<SimulatorConfig>): void {
    const wasRunning = this.isRunning;

    // Stop the simulation if it's running
    if (wasRunning) {
      this.stopSimulation();
    }

    // Update the configuration
    this.config = {
      ...this.config,
      ...config,
    };

    // Reinitialize with new configuration
    this.driverSimulatorService.initialize(this.config);

    // Restart if it was running before
    if (wasRunning) {
      this.startSimulation();
    }

    this.logger.log('Simulator configuration updated');
  }

  /**
   * Get the current simulation status
   */
  getStatus(): { isRunning: boolean; config: SimulatorConfig; activeDrivers: number } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      activeDrivers: this.driverSimulatorService.getActiveDriverCount(),
    };
  }
}
