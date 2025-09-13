/**
 * Test script for the driver simulator
 * 
 * This script demonstrates how to use the driver simulator programmatically.
 * To run it, use: npx ts-node src/modules/simulator/test-simulator.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SimulatorService } from './services/simulator.service';
import { DriverSimulatorService } from './services/driver-simulator.service';
import { VisualizationService } from './services/visualization.service';

async function bootstrap() {
  // Create a NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Get the simulator services
    const simulatorService = app.get(SimulatorService);
    const driverSimulatorService = app.get(DriverSimulatorService);
    const visualizationService = app.get(VisualizationService);

    console.log('Starting driver simulator test...');

    // Configure the simulator
    simulatorService.updateConfig({
      driverCount: 20, // Simulate 20 drivers
      updateFrequencyMs: 100, // 10 updates per second
      initialRegion: {
        centerLat: 37.7749, // San Francisco
        centerLng: -122.4194,
        radiusKm: 3,
      },
    });

    console.log('Simulator configured');
    console.log('Starting simulation...');

    // Start the simulation
    await simulatorService.startSimulation();

    console.log('Simulation started');
    console.log('Waiting for 5 seconds to generate some movement data...');

    // Wait for 5 seconds to generate some movement data
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get all drivers
    const drivers = driverSimulatorService.getAllDrivers();
    console.log(`Active drivers: ${drivers.length}`);

    // Generate visualization
    const visualizationPath = await visualizationService.generateVisualization(drivers);
    console.log(`Visualization generated at: ${visualizationPath}`);

    // Generate GeoJSON
    const geoJsonPath = await visualizationService.generateGeoJson(drivers);
    console.log(`GeoJSON generated at: ${geoJsonPath}`);

    // Set a destination for the first driver
    if (drivers.length > 0) {
      const firstDriver = drivers[0];
      const success = driverSimulatorService.setDriverDestination(
        firstDriver.id,
        firstDriver.latitude + 0.01, // Destination slightly north
        firstDriver.longitude + 0.01, // and east of current position
      );

      if (success) {
        console.log(`Set destination for driver ${firstDriver.id}`);
      }
    }

    // Wait for another 5 seconds to see the driver moving towards the destination
    console.log('Waiting for 5 more seconds to observe driver movement...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Generate final visualization
    const finalVisualizationPath = await visualizationService.generateVisualization(
      driverSimulatorService.getAllDrivers()
    );
    console.log(`Final visualization generated at: ${finalVisualizationPath}`);

    // Stop the simulation
    simulatorService.stopSimulation();
    console.log('Simulation stopped');

  } catch (error) {
    console.error('Error during simulator test:', error);
  } finally {
    // Close the application context
    await app.close();
  }
}

// Run the test
bootstrap().catch(err => {
  console.error('Failed to bootstrap the application:', err);
  process.exit(1);
});
