# Driver Simulator

This module provides a configurable driver simulator for local testing that can simulate up to 50 drivers with realistic movement patterns.

## Features

- Simulate up to 50 concurrent virtual drivers
- Configurable update frequency (up to 10 updates/second)
- Realistic movement patterns with acceleration/deceleration
- API-compatible with production driver app
- Route generation and following
- Visualization tools for debugging

## Configuration

The simulator can be configured through environment variables or API:

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| `SIMULATOR_DRIVER_COUNT` | Number of virtual drivers to simulate | 10 |
| `SIMULATOR_UPDATE_FREQUENCY_MS` | Update frequency in milliseconds | 1000 |
| `SIMULATOR_AUTO_START` | Whether to start simulator automatically | false |
| `SIMULATOR_CENTER_LAT` | Center latitude for initial driver placement | 37.7749 |
| `SIMULATOR_CENTER_LNG` | Center longitude for initial driver placement | -122.4194 |
| `SIMULATOR_RADIUS_KM` | Radius in kilometers for initial driver placement | 5 |
| `SIMULATOR_API_KEY` | API key for simulator endpoints | simulator-local-dev |
| `LOCATION_UPDATE_ENDPOINT` | Endpoint to send location updates to | http://localhost:3000/api/tracking/simulator/location |

## API Endpoints

### GET /simulator

Get the current status of the simulator.

**Response:**
```json
{
  "isRunning": true,
  "config": {
    "driverCount": 10,
    "updateFrequencyMs": 1000,
    "autoStart": false,
    "initialRegion": {
      "centerLat": 37.7749,
      "centerLng": -122.4194,
      "radiusKm": 5
    }
  },
  "activeDrivers": 10
}
```

### POST /simulator/start

Start the simulator.

**Response:**
```json
{
  "message": "Simulator started successfully"
}
```

### POST /simulator/stop

Stop the simulator.

**Response:**
```json
{
  "message": "Simulator stopped successfully"
}
```

### POST /simulator/config

Update the simulator configuration.

**Request Body:**
```json
{
  "driverCount": 20,
  "updateFrequencyMs": 500,
  "autoStart": true,
  "initialRegion": {
    "centerLat": 37.7749,
    "centerLng": -122.4194,
    "radiusKm": 3
  }
}
```

**Response:**
```json
{
  "message": "Configuration updated successfully"
}
```

### GET /simulator/drivers

Get all virtual drivers.

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "heading": 90,
    "speed": 30,
    "accuracy": 5,
    "batteryLevel": 80,
    "status": "available"
  },
  ...
]
```

### GET /simulator/drivers/:id

Get a specific driver by ID.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "heading": 90,
  "speed": 30,
  "accuracy": 5,
  "batteryLevel": 80,
  "status": "available"
}
```

### POST /simulator/drivers/:id/destination

Set a destination for a driver.

**Request Body:**
```json
{
  "latitude": 37.7833,
  "longitude": -122.4167
}
```

**Response:**
```json
{
  "message": "Destination set successfully"
}
```

### GET /simulator/visualization

Generate an HTML visualization of driver positions.

**Response:**
```json
{
  "visualizationPath": "/path/to/visualization.html"
}
```

### GET /simulator/geojson

Generate a GeoJSON file with driver positions.

**Response:**
```json
{
  "geoJsonPath": "/path/to/driver-positions.geojson"
}
```

## Usage Examples

### Starting the Simulator

```typescript
// Inject the SimulatorService
constructor(private readonly simulatorService: SimulatorService) {}

// Start the simulator
async startSimulation() {
  await this.simulatorService.startSimulation();
}
```

### Configuring the Simulator

```typescript
// Update configuration
this.simulatorService.updateConfig({
  driverCount: 20,
  updateFrequencyMs: 500,
  initialRegion: {
    centerLat: 37.7749,
    centerLng: -122.4194,
    radiusKm: 3
  }
});
```

### Setting a Destination for a Driver

```typescript
// Set destination for a driver
this.driverSimulatorService.setDriverDestination(
  '550e8400-e29b-41d4-a716-446655440000',
  37.7833,
  -122.4167
);
```

## Performance Considerations

The simulator is designed to handle up to 50 drivers with 10 updates per second on a development machine. For optimal performance:

1. Adjust the update frequency based on your machine's capabilities
2. Use batch updates for location data
3. Consider reducing the number of drivers if you experience performance issues

## Visualization

The simulator includes visualization tools for debugging:

1. HTML map visualization with real-time driver positions
2. GeoJSON export for use with external mapping tools

To view the visualization:
1. Start the simulator
2. Call the `/simulator/visualization` endpoint
3. Open the generated HTML file in a browser

## Integration with Tracking System

The simulator is designed to be API-compatible with the production driver app. It sends location updates to the tracking system using a special endpoint that doesn't require authentication.

By default, location updates are sent to `http://localhost:3000/api/tracking/simulator/location`. This can be configured using the `LOCATION_UPDATE_ENDPOINT` environment variable.

### Authentication

The simulator uses a simple API key authentication mechanism. The API key is sent in the `x-simulator-key` header with each request. The default API key is `simulator-local-dev`, but you can change it by setting the `SIMULATOR_API_KEY` environment variable.

```typescript
// Example of sending location updates with API key
fetch('http://localhost:3000/api/tracking/simulator/location', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-simulator-key': 'simulator-local-dev'
  },
  body: JSON.stringify(locationUpdates)
});
```
