# Driver Simulator Environment Variables

This document describes the environment variables used to configure the driver simulator.

## Configuration Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SIMULATOR_DRIVER_COUNT` | Number of virtual drivers to simulate | `10` | `20` |
| `SIMULATOR_UPDATE_FREQUENCY_MS` | Update frequency in milliseconds | `1000` | `100` |
| `SIMULATOR_AUTO_START` | Whether to start simulator automatically on application startup | `false` | `true` |
| `SIMULATOR_CENTER_LAT` | Center latitude for initial driver placement | `37.7749` | `40.7128` |
| `SIMULATOR_CENTER_LNG` | Center longitude for initial driver placement | `-122.4194` | `-74.0060` |
| `SIMULATOR_RADIUS_KM` | Radius in kilometers for initial driver placement | `5` | `3` |
| `SIMULATOR_API_KEY` | API key for simulator endpoints (for security) | `simulator-local-dev` | `your-secret-key` |
| `LOCATION_UPDATE_ENDPOINT` | Endpoint to send location updates to | `http://localhost:3000/api/tracking/simulator/location` | `https://api.example.com/tracking/location` |

## Usage

You can set these environment variables in your `.env` file or directly in your shell before starting the application:

```bash
# Set environment variables
export SIMULATOR_DRIVER_COUNT=30
export SIMULATOR_UPDATE_FREQUENCY_MS=200
export SIMULATOR_AUTO_START=true

# Start the application
npm run start:dev
```

## Performance Considerations

- For high update frequencies (< 200ms), consider reducing the number of drivers to avoid performance issues
- The simulator is designed to handle up to 50 drivers with 10 updates/second (100ms) on a development machine
- For production-like testing with more drivers, consider deploying the simulator on a more powerful machine

## Security Note

The `SIMULATOR_API_KEY` is used to authenticate requests to the simulator endpoints. In a production environment, you should set this to a secure random string and keep it confidential.
