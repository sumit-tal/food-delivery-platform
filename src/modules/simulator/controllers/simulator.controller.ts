import { Controller, Get, Post, Body, Param, HttpStatus, HttpCode, Logger } from '@nestjs/common';
import { SimulatorService } from '../services/simulator.service';
import { DriverSimulatorService } from '../services/driver-simulator.service';
import { VisualizationService } from '../services/visualization.service';
import { SimulatorConfigDto, DriverDestinationDto } from '../dto';

/**
 * Controller for driver simulator endpoints
 */
@Controller('simulator')
export class SimulatorController {
  private readonly logger = new Logger(SimulatorController.name);

  constructor(
    private readonly simulatorService: SimulatorService,
    private readonly driverSimulatorService: DriverSimulatorService,
    private readonly visualizationService: VisualizationService,
  ) {}

  /**
   * Get simulator status
   */
  @Get()
  /**
   * Get simulator status
   */
  getStatus(): { isRunning: boolean; config: SimulatorConfigDto; activeDrivers: number } {
    return this.simulatorService.getStatus();
  }

  /**
   * Start the simulator
   */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  /**
   * Start the simulator
   */
  async startSimulator(): Promise<{ message: string }> {
    await this.simulatorService.startSimulation();
    return { message: 'Simulator started successfully' };
  }

  /**
   * Stop the simulator
   */
  @Post('stop')
  @HttpCode(HttpStatus.OK)
  /**
   * Stop the simulator
   */
  stopSimulator(): { message: string } {
    this.simulatorService.stopSimulation();
    return { message: 'Simulator stopped successfully' };
  }

  /**
   * Update simulator configuration
   */
  @Post('config')
  @HttpCode(HttpStatus.OK)
  /**
   * Update simulator configuration
   */
  updateConfig(@Body() configDto: SimulatorConfigDto): { message: string } {
    this.simulatorService.updateConfig(configDto);
    return { message: 'Configuration updated successfully' };
  }

  /**
   * Get all virtual drivers
   */
  @Get('drivers')
  /**
   * Get all virtual drivers
   */
  getAllDrivers(): Array<{ id: string; latitude: number; longitude: number; heading: number; speed: number; batteryLevel: number; accuracy: number; status: string }> {
    return this.driverSimulatorService.getAllDrivers();
  }

  /**
   * Get a specific driver by ID
   */
  @Get('drivers/:id')
  /**
   * Get a specific driver by ID
   */
  getDriverById(@Param('id') id: string): { id: string; latitude: number; longitude: number; heading: number; speed: number; batteryLevel: number; accuracy: number; status: string } | undefined {
    return this.driverSimulatorService.getDriverById(id);
  }

  /**
   * Set a destination for a driver
   */
  @Post('drivers/:id/destination')
  @HttpCode(HttpStatus.OK)
  /**
   * Set a destination for a driver
   */
  setDriverDestination(
    @Param('id') id: string,
    @Body() destinationDto: DriverDestinationDto,
  ): { message: string } {
    const success = this.driverSimulatorService.setDriverDestination(
      id,
      destinationDto.latitude,
      destinationDto.longitude,
    );
    
    if (success) {
      return { message: 'Destination set successfully' };
    } else {
      return { message: 'Driver not found' };
    }
  }

  /**
   * Generate visualization
   */
  @Get('visualization')
  /**
   * Generate visualization of driver positions
   */
  async generateVisualization(): Promise<{ visualizationPath: string }> {
    const drivers = this.driverSimulatorService.getAllDrivers();
    const filePath = await this.visualizationService.generateVisualization(drivers);
    return { visualizationPath: filePath };
  }

  /**
   * Generate GeoJSON
   */
  @Get('geojson')
  /**
   * Generate GeoJSON of driver positions
   */
  async generateGeoJson(): Promise<{ geoJsonPath: string }> {
    const drivers = this.driverSimulatorService.getAllDrivers();
    const filePath = await this.visualizationService.generateGeoJson(drivers);
    return { geoJsonPath: filePath };
  }
}
