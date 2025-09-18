import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for scaling verification
const scalingEfficiency = new Trend('scaling_efficiency'); // Response time improvement ratio
const throughputGrowth = new Counter('throughput_growth');
const resourceUtilization = new Trend('resource_utilization');
const scalingLatency = new Trend('scaling_response_time');
const errorRateDuringScaling = new Rate('error_rate_during_scaling');

// Test configuration for scaling verification
export const options = {
  scenarios: {
    // Gradual load increase to test auto-scaling
    gradual_scaling: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m', target: 50 },   // Ramp to 50 users
        { duration: '3m', target: 50 },   // Hold at 50
        { duration: '2m', target: 150 },  // Ramp to 150 users
        { duration: '3m', target: 150 },  // Hold at 150
        { duration: '2m', target: 300 },  // Ramp to 300 users
        { duration: '5m', target: 300 },  // Hold at 300
        { duration: '2m', target: 500 },  // Ramp to 500 users
        { duration: '5m', target: 500 },  // Hold at 500
        { duration: '3m', target: 50 },   // Scale down
      ],
      tags: { scenario: 'gradual_scaling' },
    },
    // Spike test to verify rapid scaling
    spike_scaling: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 10 },   // Baseline
        { duration: '30s', target: 200 }, // Sudden spike
        { duration: '2m', target: 200 },  // Hold spike
        { duration: '30s', target: 10 },  // Drop back
        { duration: '1m', target: 10 },   // Baseline
      ],
      startTime: '20m', // Run after gradual scaling
      tags: { scenario: 'spike_scaling' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s even during scaling
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    error_rate_during_scaling: ['rate<0.1'], // Allow slightly higher error rate during scaling
    scaling_response_time: ['p(90)<2000'], // 90% of scaling responses under 2s
    checks: ['rate>0.9'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const METRICS_URL = __ENV.METRICS_URL || 'http://localhost:3000/metrics'; // Prometheus metrics endpoint

// Test data
const testUsers = [];
for (let i = 1; i <= 50; i++) {
  testUsers.push({
    email: `scaling${i}@example.com`,
    password: 'password123',
  });
}

const testScenarios = [
  'browse_restaurants',
  'view_menu',
  'place_order',
  'track_order',
  'update_profile',
];

// Authentication cache
let authTokens = {};

function getAuthToken(userIndex) {
  if (authTokens[userIndex]) {
    return authTokens[userIndex];
  }

  const user = testUsers[userIndex % testUsers.length];
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginResponse.status === 200) {
    const token = JSON.parse(loginResponse.body).access_token;
    authTokens[userIndex] = token;
    return token;
  }
  
  return null;
}

// Track performance metrics over time
let performanceHistory = [];

export default function () {
  const userIndex = __VU; // Use VU number as user index
  const token = getAuthToken(userIndex);
  
  if (!token) {
    errorRateDuringScaling.add(true);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Record start time for this iteration
  const iterationStart = Date.now();
  
  // Execute random scenario
  const scenario = testScenarios[Math.floor(Math.random() * testScenarios.length)];
  const success = executeScenario(scenario, headers);
  
  const iterationEnd = Date.now();
  const responseTime = iterationEnd - iterationStart;
  
  scalingLatency.add(responseTime);
  throughputGrowth.add(1);
  
  if (!success) {
    errorRateDuringScaling.add(true);
  }

  // Collect system metrics periodically
  if (__ITER % 10 === 0) {
    collectSystemMetrics();
  }

  // Record performance data for scaling analysis
  performanceHistory.push({
    timestamp: Date.now(),
    vus: __VU,
    responseTime: responseTime,
    success: success,
  });

  sleep(Math.random() * 2 + 1); // 1-3 seconds think time
}

function executeScenario(scenario, headers) {
  switch (scenario) {
    case 'browse_restaurants':
      return testBrowseRestaurants(headers);
    case 'view_menu':
      return testViewMenu(headers);
    case 'place_order':
      return testPlaceOrder(headers);
    case 'track_order':
      return testTrackOrder(headers);
    case 'update_profile':
      return testUpdateProfile(headers);
    default:
      return false;
  }
}

function testBrowseRestaurants(headers) {
  const response = http.get(`${BASE_URL}/restaurants?page=1&limit=20`, { headers });
  
  return check(response, {
    'browse restaurants successful': (r) => r.status === 200,
    'browse restaurants fast': (r) => r.timings.duration < 500,
  });
}

function testViewMenu(headers) {
  const restaurantId = `restaurant-scaling-${Math.floor(Math.random() * 5) + 1}`;
  const response = http.get(`${BASE_URL}/restaurants/${restaurantId}/menu`, { headers });
  
  return check(response, {
    'view menu successful': (r) => r.status === 200,
    'view menu fast': (r) => r.timings.duration < 800,
  });
}

function testPlaceOrder(headers) {
  const orderData = {
    restaurantId: `restaurant-scaling-${Math.floor(Math.random() * 5) + 1}`,
    items: [
      { menuItemId: 'item-1', quantity: 1, price: 12.99 },
    ],
    deliveryAddress: {
      street: '123 Scaling St',
      city: 'Test City',
      zipCode: '12345',
      coordinates: { lat: 40.7128, lng: -74.0060 },
    },
    paymentMethodId: 'pm_test_scaling',
  };

  const response = http.post(`${BASE_URL}/orders`, JSON.stringify(orderData), { headers });
  
  return check(response, {
    'place order successful': (r) => r.status === 201,
    'place order reasonable time': (r) => r.timings.duration < 2000,
  });
}

function testTrackOrder(headers) {
  const orderId = `order-scaling-${Math.floor(Math.random() * 100) + 1}`;
  const response = http.get(`${BASE_URL}/orders/${orderId}/tracking`, { headers });
  
  return check(response, {
    'track order response': (r) => r.status === 200 || r.status === 404,
    'track order fast': (r) => r.timings.duration < 300,
  });
}

function testUpdateProfile(headers) {
  const profileData = {
    name: `Scaling User ${__VU}`,
    phone: `+123456${String(__VU).padStart(4, '0')}`,
  };

  const response = http.put(`${BASE_URL}/users/profile`, JSON.stringify(profileData), { headers });
  
  return check(response, {
    'update profile successful': (r) => r.status === 200,
    'update profile fast': (r) => r.timings.duration < 600,
  });
}

function collectSystemMetrics() {
  // Collect system metrics to analyze scaling behavior
  const metricsResponse = http.get(METRICS_URL, {
    headers: { 'Accept': 'text/plain' },
  });
  
  if (metricsResponse.status === 200) {
    // Parse basic metrics (in a real scenario, you'd parse Prometheus format)
    const metrics = metricsResponse.body;
    
    // Extract CPU and memory usage (simplified)
    const cpuMatch = metrics.match(/cpu_usage_percent\s+(\d+\.?\d*)/);
    const memoryMatch = metrics.match(/memory_usage_percent\s+(\d+\.?\d*)/);
    
    if (cpuMatch) {
      resourceUtilization.add(parseFloat(cpuMatch[1]));
    }
    
    // Calculate scaling efficiency
    if (performanceHistory.length > 1) {
      const recent = performanceHistory.slice(-10);
      const avgResponseTime = recent.reduce((sum, p) => sum + p.responseTime, 0) / recent.length;
      const avgVUs = recent.reduce((sum, p) => sum + p.vus, 0) / recent.length;
      
      // Efficiency = throughput increase / resource increase
      const efficiency = avgVUs / (avgResponseTime / 100); // Normalized
      scalingEfficiency.add(efficiency);
    }
  }
}

// Test specific scaling scenarios
export function testHorizontalScaling() {
  // This would typically interact with container orchestration
  console.log('Testing horizontal scaling...');
  
  // Simulate checking if new instances are being created
  const scalingResponse = http.get(`${BASE_URL}/health/scaling-status`);
  
  return check(scalingResponse, {
    'scaling status available': (r) => r.status === 200,
    'scaling is active': (r) => {
      if (r.status === 200) {
        try {
          const body = JSON.parse(r.body);
          return body.scaling === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
  });
}

export function testVerticalScaling() {
  // Test if the system can handle increased load on existing instances
  console.log('Testing vertical scaling capabilities...');
  
  const heavyOperations = [];
  for (let i = 0; i < 5; i++) {
    heavyOperations.push(
      http.get(`${BASE_URL}/restaurants?page=${i + 1}&limit=50`)
    );
  }
  
  const responses = http.batch(heavyOperations);
  
  return responses.every(response => 
    check(response, {
      'heavy operation successful': (r) => r.status === 200,
      'heavy operation reasonable time': (r) => r.timings.duration < 3000,
    })
  );
}

export function setup() {
  console.log('Starting Scaling Verification Tests');
  console.log('Testing auto-scaling behavior under varying loads');
  console.log(`Base URL: ${BASE_URL}`);
  
  // Pre-authenticate some users
  for (let i = 0; i < 10; i++) {
    getAuthToken(i);
  }
  
  // Initialize performance tracking
  performanceHistory = [];
}

export function teardown(data) {
  console.log('Scaling Verification Tests completed');
  
  // Analyze scaling performance
  if (performanceHistory.length > 0) {
    const avgResponseTime = performanceHistory.reduce((sum, p) => sum + p.responseTime, 0) / performanceHistory.length;
    const maxVUs = Math.max(...performanceHistory.map(p => p.vus));
    const successRate = performanceHistory.filter(p => p.success).length / performanceHistory.length;
    
    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Maximum VUs Handled: ${maxVUs}`);
    console.log(`Success Rate: ${(successRate * 100).toFixed(2)}%`);
  }
  
  console.log('Check scaling efficiency and resource utilization metrics');
}
