#!/bin/bash

# Script to run the driver simulator
# Usage: ./scripts/run-simulator.sh [driver_count] [update_frequency_ms]

# Default values
DRIVER_COUNT=${1:-20}
UPDATE_FREQUENCY_MS=${2:-100}

# Set environment variables for the simulator
export SIMULATOR_DRIVER_COUNT=$DRIVER_COUNT
export SIMULATOR_UPDATE_FREQUENCY_MS=$UPDATE_FREQUENCY_MS
export SIMULATOR_AUTO_START=true
export SIMULATOR_CENTER_LAT=37.7749
export SIMULATOR_CENTER_LNG=-122.4194
export SIMULATOR_RADIUS_KM=3

echo "Starting driver simulator with $DRIVER_COUNT drivers and ${UPDATE_FREQUENCY_MS}ms update frequency"

# Run the application with the simulator enabled
npm run start:dev
