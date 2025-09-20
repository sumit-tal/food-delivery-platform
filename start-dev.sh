#!/bin/bash

# Start the development server with explicit environment variables
export ELASTICSEARCH_ENABLED=false
export ALERTING_ENABLED=false
export POSTGIS_REQUIRED=false

echo "Starting development server with:"
echo "ELASTICSEARCH_ENABLED=$ELASTICSEARCH_ENABLED"
echo "ALERTING_ENABLED=$ALERTING_ENABLED"
echo "POSTGIS_REQUIRED=$POSTGIS_REQUIRED"

npm run start:dev
