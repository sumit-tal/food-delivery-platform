import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestCount = new Counter('requests');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.05'], // Error rate must be below 5%
    errors: ['rate<0.05'],
    response_time: ['p(95)<500'],
  },
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'password123' },
  { email: 'test2@example.com', password: 'password123' },
  { email: 'test3@example.com', password: 'password123' },
];

const testRestaurants = [
  'restaurant-1',
  'restaurant-2',
  'restaurant-3',
];

// Authentication helper
function authenticate() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  const loginResponse = http.post(`${BASE_URL}/auth/login`, {
    email: user.email,
    password: user.password,
  }, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginResponse.status === 200) {
    const token = JSON.parse(loginResponse.body).access_token;
    return { Authorization: `Bearer ${token}` };
  }
  return null;
}

// Main test function
export default function () {
  requestCount.add(1);
  
  // Authenticate user
  const headers = authenticate();
  if (!headers) {
    errorRate.add(1);
    return;
  }

  // Test scenarios with weighted distribution
  const scenario = Math.random();
  
  if (scenario < 0.3) {
    // 30% - Browse restaurants
    testBrowseRestaurants(headers);
  } else if (scenario < 0.6) {
    // 30% - View restaurant details and menu
    testRestaurantDetails(headers);
  } else if (scenario < 0.8) {
    // 20% - Place order
    testPlaceOrder(headers);
  } else if (scenario < 0.9) {
    // 10% - Track order
    testTrackOrder(headers);
  } else {
    // 10% - Update profile
    testUpdateProfile(headers);
  }

  sleep(1); // Think time between requests
}

function testBrowseRestaurants(headers) {
  const response = http.get(`${BASE_URL}/restaurants?page=1&limit=10`, { headers });
  
  const success = check(response, {
    'browse restaurants status is 200': (r) => r.status === 200,
    'browse restaurants response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  responseTime.add(response.timings.duration);
  if (!success) errorRate.add(1);
}

function testRestaurantDetails(headers) {
  const restaurantId = testRestaurants[Math.floor(Math.random() * testRestaurants.length)];
  const response = http.get(`${BASE_URL}/restaurants/${restaurantId}`, { headers });
  
  const success = check(response, {
    'restaurant details status is 200': (r) => r.status === 200,
    'restaurant details response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  responseTime.add(response.timings.duration);
  if (!success) errorRate.add(1);
}

function testPlaceOrder(headers) {
  const restaurantId = testRestaurants[Math.floor(Math.random() * testRestaurants.length)];
  const orderData = {
    restaurantId,
    items: [
      { menuItemId: 'item-1', quantity: 2 },
      { menuItemId: 'item-2', quantity: 1 },
    ],
    deliveryAddress: {
      street: '123 Test St',
      city: 'Test City',
      zipCode: '12345',
      coordinates: { lat: 40.7128, lng: -74.0060 },
    },
    paymentMethodId: 'pm_test_123',
  };

  const response = http.post(`${BASE_URL}/orders`, JSON.stringify(orderData), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  
  const success = check(response, {
    'place order status is 201': (r) => r.status === 201,
    'place order response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  responseTime.add(response.timings.duration);
  if (!success) errorRate.add(1);
}

function testTrackOrder(headers) {
  // Simulate tracking an existing order
  const orderId = 'order-test-123';
  const response = http.get(`${BASE_URL}/orders/${orderId}/tracking`, { headers });
  
  const success = check(response, {
    'track order response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  responseTime.add(response.timings.duration);
  if (response.status !== 200 && response.status !== 404) {
    errorRate.add(1);
  }
}

function testUpdateProfile(headers) {
  const profileData = {
    name: 'Test User',
    phone: '+1234567890',
  };

  const response = http.put(`${BASE_URL}/users/profile`, JSON.stringify(profileData), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  
  const success = check(response, {
    'update profile response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  responseTime.add(response.timings.duration);
  if (response.status !== 200) {
    errorRate.add(1);
  }
}

// Setup and teardown functions
export function setup() {
  console.log('Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
}

export function teardown(data) {
  console.log('Load test completed');
}
