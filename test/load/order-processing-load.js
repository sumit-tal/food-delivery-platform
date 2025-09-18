import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const orderSuccessRate = new Rate('order_success_rate');
const orderProcessingTime = new Trend('order_processing_time');
const ordersPerSecond = new Counter('orders_per_second');

// Test configuration for 500 orders/minute (8.33 orders/second)
export const options = {
  scenarios: {
    order_processing: {
      executor: 'constant-arrival-rate',
      rate: 8.33, // 8.33 requests per second = ~500 per minute
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.02'], // Error rate must be below 2%
    order_success_rate: ['rate>0.98'], // 98% success rate
    order_processing_time: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data pools
const testUsers = [
  { email: 'loadtest1@example.com', password: 'password123' },
  { email: 'loadtest2@example.com', password: 'password123' },
  { email: 'loadtest3@example.com', password: 'password123' },
  { email: 'loadtest4@example.com', password: 'password123' },
  { email: 'loadtest5@example.com', password: 'password123' },
];

const testRestaurants = [
  'restaurant-load-1',
  'restaurant-load-2',
  'restaurant-load-3',
  'restaurant-load-4',
  'restaurant-load-5',
];

const menuItems = [
  { id: 'item-burger', price: 12.99 },
  { id: 'item-pizza', price: 18.99 },
  { id: 'item-salad', price: 9.99 },
  { id: 'item-pasta', price: 14.99 },
  { id: 'item-sandwich', price: 8.99 },
];

const deliveryAddresses = [
  {
    street: '123 Main St',
    city: 'New York',
    zipCode: '10001',
    coordinates: { lat: 40.7128, lng: -74.0060 },
  },
  {
    street: '456 Broadway',
    city: 'New York',
    zipCode: '10002',
    coordinates: { lat: 40.7589, lng: -73.9851 },
  },
  {
    street: '789 Park Ave',
    city: 'New York',
    zipCode: '10003',
    coordinates: { lat: 40.7505, lng: -73.9934 },
  },
];

// Authentication cache
let authTokens = {};

function getAuthToken(userIndex) {
  if (authTokens[userIndex]) {
    return authTokens[userIndex];
  }

  const user = testUsers[userIndex];
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

export default function () {
  const userIndex = Math.floor(Math.random() * testUsers.length);
  const token = getAuthToken(userIndex);
  
  if (!token) {
    console.error('Failed to authenticate user');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Generate realistic order data
  const restaurantId = testRestaurants[Math.floor(Math.random() * testRestaurants.length)];
  const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items per order
  const items = [];
  
  for (let i = 0; i < numItems; i++) {
    const menuItem = menuItems[Math.floor(Math.random() * menuItems.length)];
    items.push({
      menuItemId: menuItem.id,
      quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
      price: menuItem.price,
    });
  }

  const deliveryAddress = deliveryAddresses[Math.floor(Math.random() * deliveryAddresses.length)];
  
  const orderData = {
    restaurantId,
    items,
    deliveryAddress,
    paymentMethodId: 'pm_test_card',
    specialInstructions: Math.random() > 0.7 ? 'Extra sauce please' : undefined,
    tip: Math.floor(Math.random() * 5) + 1, // $1-5 tip
  };

  // Place order
  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/orders`, JSON.stringify(orderData), { headers });
  const endTime = Date.now();
  
  const processingTime = endTime - startTime;
  orderProcessingTime.add(processingTime);
  ordersPerSecond.add(1);

  const success = check(response, {
    'order creation status is 201': (r) => r.status === 201,
    'order has valid ID': (r) => {
      if (r.status === 201) {
        const body = JSON.parse(r.body);
        return body.id && body.id.length > 0;
      }
      return false;
    },
    'order processing time < 2000ms': () => processingTime < 2000,
    'response contains order details': (r) => {
      if (r.status === 201) {
        const body = JSON.parse(r.body);
        return body.status && body.totalAmount && body.estimatedDeliveryTime;
      }
      return false;
    },
  });

  orderSuccessRate.add(success);

  // If order was successful, test order retrieval
  if (response.status === 201) {
    const orderBody = JSON.parse(response.body);
    const orderId = orderBody.id;
    
    // Small delay before retrieving order
    sleep(0.1);
    
    const getOrderResponse = http.get(`${BASE_URL}/orders/${orderId}`, { headers });
    check(getOrderResponse, {
      'order retrieval status is 200': (r) => r.status === 200,
      'retrieved order matches created order': (r) => {
        if (r.status === 200) {
          const retrievedOrder = JSON.parse(r.body);
          return retrievedOrder.id === orderId;
        }
        return false;
      },
    });
  }

  // Simulate realistic user behavior - small pause between actions
  sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6 seconds
}

export function setup() {
  console.log('Starting Order Processing Load Test');
  console.log('Target: 500 orders per minute (8.33 orders/second)');
  console.log(`Base URL: ${BASE_URL}`);
  
  // Pre-authenticate some users to reduce auth overhead during test
  for (let i = 0; i < Math.min(testUsers.length, 3); i++) {
    getAuthToken(i);
  }
}

export function teardown(data) {
  console.log('Order Processing Load Test completed');
  console.log('Check the metrics for order processing performance');
}
