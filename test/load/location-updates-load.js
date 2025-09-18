import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const locationUpdateRate = new Rate('location_update_success_rate');
const locationUpdateLatency = new Trend('location_update_latency');
const updatesPerSecond = new Counter('updates_per_second');
const wsConnectionRate = new Rate('ws_connection_success_rate');

// Test configuration for 2,000 location updates/second
export const options = {
  scenarios: {
    location_updates: {
      executor: 'constant-arrival-rate',
      rate: 2000, // 2000 requests per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 200,
      maxVUs: 500,
    },
  },
  thresholds: {
    location_update_latency: ['p(95)<100'], // 95% of updates must complete below 100ms
    location_update_success_rate: ['rate>0.99'], // 99% success rate
    ws_connection_success_rate: ['rate>0.95'], // 95% WebSocket connection success
    checks: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

// Test data pools
const testDrivers = [];
for (let i = 1; i <= 100; i++) {
  testDrivers.push({
    id: `driver-load-${i}`,
    email: `driver${i}@loadtest.com`,
    password: 'password123',
  });
}

// NYC area coordinates for realistic location simulation
const nycBounds = {
  north: 40.9176,
  south: 40.4774,
  east: -73.7004,
  west: -74.2591,
};

// Generate random location within NYC bounds
function generateRandomLocation() {
  const lat = Math.random() * (nycBounds.north - nycBounds.south) + nycBounds.south;
  const lng = Math.random() * (nycBounds.east - nycBounds.west) + nycBounds.west;
  return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
}

// Simulate realistic driver movement
function simulateDriverMovement(previousLocation) {
  if (!previousLocation) {
    return generateRandomLocation();
  }

  // Small movement (realistic for a moving vehicle)
  const maxMovement = 0.001; // ~100 meters
  const lat = previousLocation.lat + (Math.random() - 0.5) * maxMovement;
  const lng = previousLocation.lng + (Math.random() - 0.5) * maxMovement;

  // Ensure we stay within NYC bounds
  return {
    lat: Math.max(nycBounds.south, Math.min(nycBounds.north, parseFloat(lat.toFixed(6)))),
    lng: Math.max(nycBounds.west, Math.min(nycBounds.east, parseFloat(lng.toFixed(6)))),
  };
}

// Authentication cache
let driverTokens = {};

function getDriverToken(driverIndex) {
  if (driverTokens[driverIndex]) {
    return driverTokens[driverIndex];
  }

  const driver = testDrivers[driverIndex];
  const loginResponse = http.post(`${BASE_URL}/auth/driver/login`, JSON.stringify({
    email: driver.email,
    password: driver.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginResponse.status === 200) {
    const token = JSON.parse(loginResponse.body).access_token;
    driverTokens[driverIndex] = token;
    return token;
  }

  return null;
}

// Driver location state
let driverLocations = {};

export default function () {
  const driverIndex = Math.floor(Math.random() * testDrivers.length);
  const driver = testDrivers[driverIndex];
  const token = getDriverToken(driverIndex);

  if (!token) {
    console.error(`Failed to authenticate driver ${driver.id}`);
    return;
  }

  // Use WebSocket for real-time updates (more realistic)
  const useWebSocket = Math.random() > 0.3; // 70% WebSocket, 30% HTTP

  if (useWebSocket) {
    testWebSocketLocationUpdate(driver, token);
  } else {
    testHttpLocationUpdate(driver, token);
  }
}

function testWebSocketLocationUpdate(driver, token) {
  const wsUrl = `${WS_URL}/tracking?token=${token}`;

  const response = ws.connect(wsUrl, {}, function (socket) {
    socket.on('open', function () {
      wsConnectionRate.add(true);

      // Send location update
      const previousLocation = driverLocations[driver.id];
      const newLocation = simulateDriverMovement(previousLocation);
      driverLocations[driver.id] = newLocation;

      const locationUpdate = {
        type: 'location_update',
        driverId: driver.id,
        location: newLocation,
        timestamp: new Date().toISOString(),
        speed: Math.floor(Math.random() * 60) + 10, // 10-70 km/h
        heading: Math.floor(Math.random() * 360), // 0-359 degrees
        accuracy: Math.floor(Math.random() * 10) + 5, // 5-15 meters
      };

      const startTime = Date.now();
      socket.send(JSON.stringify(locationUpdate));
      updatesPerSecond.add(1);

      socket.on('message', function (message) {
        const endTime = Date.now();
        const latency = endTime - startTime;
        locationUpdateLatency.add(latency);

        const success = check(message, {
          'location update acknowledged': (msg) => {
            try {
              const response = JSON.parse(msg);
              return response.type === 'location_update_ack' && response.driverId === driver.id;
            } catch (e) {
              return false;
            }
          },
        });

        locationUpdateRate.add(success);
        socket.close();
      });

      socket.on('error', function (e) {
        console.error(`WebSocket error for driver ${driver.id}:`, e);
        locationUpdateRate.add(false);
        wsConnectionRate.add(false);
      });
    });

    socket.on('close', function () {
      // Connection closed
    });
  });

  if (!response) {
    wsConnectionRate.add(false);
    locationUpdateRate.add(false);
  }
}

function testHttpLocationUpdate(driver, token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const previousLocation = driverLocations[driver.id];
  const newLocation = simulateDriverMovement(previousLocation);
  driverLocations[driver.id] = newLocation;

  const locationUpdate = {
    driverId: driver.id,
    location: newLocation,
    timestamp: new Date().toISOString(),
    speed: Math.floor(Math.random() * 60) + 10,
    heading: Math.floor(Math.random() * 360),
    accuracy: Math.floor(Math.random() * 10) + 5,
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/tracking/location`, JSON.stringify(locationUpdate), { headers });
  const endTime = Date.now();

  const latency = endTime - startTime;
  locationUpdateLatency.add(latency);
  updatesPerSecond.add(1);

  const success = check(response, {
    'HTTP location update status is 200': (r) => r.status === 200,
    'HTTP location update latency < 100ms': () => latency < 100,
    'HTTP response contains acknowledgment': (r) => {
      if (r.status === 200) {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
  });

  locationUpdateRate.add(success);
}

export function setup() {
  console.log('Starting Real-Time Location Updates Load Test');
  console.log('Target: 2,000 location updates per second');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`WebSocket URL: ${WS_URL}`);

  // Pre-authenticate some drivers to reduce auth overhead
  for (let i = 0; i < Math.min(testDrivers.length, 10); i++) {
    getDriverToken(i);
  }

  // Initialize some driver locations
  for (let i = 0; i < 20; i++) {
    driverLocations[testDrivers[i].id] = generateRandomLocation();
  }
}

export function teardown(data) {
  console.log('Real-Time Location Updates Load Test completed');
  console.log('Check the metrics for location update performance');
}
