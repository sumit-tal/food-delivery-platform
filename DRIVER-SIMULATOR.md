# Driver Simulator

This document provides instructions for using the driver simulator for local testing of the SwiftEats food delivery platform.

## Overview

The driver simulator allows you to simulate up to 50 drivers with realistic movement patterns for testing the real-time tracking system locally. It provides:

- Configurable number of virtual drivers (up to 50)
- Adjustable update frequency (up to 10 updates/second)
- Realistic movement patterns with acceleration/deceleration
- Route generation and following capabilities
- Visualization tools for debugging

## Getting Started

### Running the Simulator

You can run the simulator using the provided script:

```bash
# Run with default settings (20 drivers, 10 updates/second)
./scripts/run-simulator.sh

# Run with custom settings
./scripts/run-simulator.sh 30 200  # 30 drivers, 5 updates/second (200ms)
```

### Environment Variables

The simulator can be configured using the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SIMULATOR_DRIVER_COUNT` | Number of virtual drivers to simulate | 10 |
| `SIMULATOR_UPDATE_FREQUENCY_MS` | Update frequency in milliseconds | 1000 |
| `SIMULATOR_AUTO_START` | Whether to start simulator automatically | false |
| `SIMULATOR_CENTER_LAT` | Center latitude for initial driver placement | 37.7749 |
| `SIMULATOR_CENTER_LNG` | Center longitude for initial driver placement | -122.4194 |
| `SIMULATOR_RADIUS_KM` | Radius in kilometers for initial driver placement | 5 |

## API Endpoints

The simulator provides the following API endpoints:

### GET /simulator

Get the current status of the simulator.

### POST /simulator/start

Start the simulator.

### POST /simulator/stop

Stop the simulator.

### POST /simulator/config

Update the simulator configuration.

Example request body:
```json
{
  "driverCount": 20,
  "updateFrequencyMs": 100,
  "initialRegion": {
    "centerLat": 37.7749,
    "centerLng": -122.4194,
    "radiusKm": 3
  }
}
```

### GET /simulator/drivers

Get all virtual drivers.

### GET /simulator/drivers/:id

Get a specific driver by ID.

### POST /simulator/drivers/:id/destination

Set a destination for a driver.

Example request body:
```json
{
  "latitude": 37.7833,
  "longitude": -122.4167
}
```

### GET /simulator/visualization

Generate an HTML visualization of driver positions.

### GET /simulator/geojson

Generate a GeoJSON file with driver positions.

## Visualization

The simulator includes visualization tools for debugging:

1. HTML map visualization with real-time driver positions
2. GeoJSON export for use with external mapping tools

To view the visualization:
1. Start the simulator
2. Call the `/simulator/visualization` endpoint
3. Open the generated HTML file in a browser

## Programmatic Usage

You can also use the simulator programmatically in your tests:

```typescript
// Get the simulator service
const simulatorService = app.get(SimulatorService);

// Configure the simulator
simulatorService.updateConfig({
  driverCount: 20,
  updateFrequencyMs: 100,
  initialRegion: {
    centerLat: 37.7749,
    centerLng: -122.4194,
    radiusKm: 3,
  },
});

// Start the simulation
await simulatorService.startSimulation();

// Get all drivers
const driverSimulatorService = app.get(DriverSimulatorService);
const drivers = driverSimulatorService.getAllDrivers();

// Set a destination for a driver
driverSimulatorService.setDriverDestination(
  driverId,
  latitude,
  longitude
);

// Stop the simulation
simulatorService.stopSimulation();
```

## Test Script

A test script is provided to demonstrate the simulator's capabilities:

```bash
npx ts-node src/modules/simulator/test-simulator.ts
```

This script:
1. Configures the simulator with 20 drivers and 10 updates/second
2. Starts the simulation
3. Generates visualizations
4. Sets a destination for one driver
5. Stops the simulation

## Performance Considerations

The simulator is designed to handle up to 50 drivers with 10 updates per second on a development machine. For optimal performance:

1. Adjust the update frequency based on your machine's capabilities
2. Use batch updates for location data
3. Consider reducing the number of drivers if you experience performance issues
