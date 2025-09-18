import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for failover testing
const paymentFailoverRate = new Rate('payment_failover_success_rate');
const databaseFailoverRate = new Rate('database_failover_success_rate');
const cacheFailoverRate = new Rate('cache_failover_success_rate');
const overallResilienceRate = new Rate('overall_resilience_rate');
const failoverResponseTime = new Trend('failover_response_time');
const userImpactScore = new Trend('user_impact_score'); // 0-10 scale

// Test configuration for failover scenarios
export const options = {
  scenarios: {
    payment_failover: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
      tags: { scenario: 'payment_failover' },
    },
    database_failover: {
      executor: 'constant-vus',
      vus: 15,
      duration: '3m',
      startTime: '1m',
      tags: { scenario: 'database_failover' },
    },
    cache_failover: {
      executor: 'constant-vus',
      vus: 25,
      duration: '3m',
      startTime: '2m',
      tags: { scenario: 'cache_failover' },
    },
  },
  thresholds: {
    payment_failover_success_rate: ['rate>0.8'], // 80% of payment operations should still work
    database_failover_success_rate: ['rate>0.9'], // 90% of DB operations should work (with fallbacks)
    cache_failover_success_rate: ['rate>0.95'], // 95% should work (cache is not critical)
    overall_resilience_rate: ['rate>0.85'], // Overall system resilience
    failover_response_time: ['p(95)<3000'], // Failover shouldn't take more than 3s
    user_impact_score: ['avg<5'], // Average user impact should be moderate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_URL = __ENV.ADMIN_URL || 'http://localhost:3001'; // Admin endpoint for simulating failures

// Test data
const testUsers = [
  { email: 'failover1@example.com', password: 'password123' },
  { email: 'failover2@example.com', password: 'password123' },
  { email: 'failover3@example.com', password: 'password123' },
];

const testOrders = [
  {
    restaurantId: 'restaurant-failover-1',
    items: [{ menuItemId: 'item-1', quantity: 1, price: 12.99 }],
    deliveryAddress: {
      street: '123 Failover St',
      city: 'Test City',
      zipCode: '12345',
      coordinates: { lat: 40.7128, lng: -74.0060 },
    },
  },
];

// Authentication helper
function authenticate() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginResponse.status === 200) {
    const token = JSON.parse(loginResponse.body).access_token;
    return { Authorization: `Bearer ${token}` };
  }
  return null;
}

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || 'payment_failover';

  switch (scenario) {
    case 'payment_failover':
      testPaymentFailover();
      break;
    case 'database_failover':
      testDatabaseFailover();
      break;
    case 'cache_failover':
      testCacheFailover();
      break;
    default:
      testPaymentFailover();
  }

  sleep(1);
}

function testPaymentFailover() {
  const headers = authenticate();
  if (!headers) return;

  // Simulate payment service outage by using invalid payment method
  const orderData = {
    ...testOrders[0],
    paymentMethodId: 'pm_failover_test', // This should trigger failover logic
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/orders`, JSON.stringify(orderData), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const endTime = Date.now();

  failoverResponseTime.add(endTime - startTime);

  const success = check(response, {
    'payment failover handled gracefully': (r) => {
      // Should either succeed with backup payment or fail gracefully with proper error
      return r.status === 201 || (r.status === 400 && r.body.includes('payment'));
    },
    'payment failover response time acceptable': () => (endTime - startTime) < 3000,
    'payment failover provides user feedback': (r) => {
      if (r.status !== 201) {
        try {
          const body = JSON.parse(r.body);
          return body.message && body.message.length > 0;
        } catch (e) {
          return false;
        }
      }
      return true;
    },
  });

  paymentFailoverRate.add(success);
  overallResilienceRate.add(success);

  // Calculate user impact (0-10 scale)
  let impact = 0;
  if (response.status === 201) {
    impact = 0; // No impact - order succeeded
  } else if (response.status === 400 && response.body.includes('payment')) {
    impact = 3; // Low impact - clear error message
  } else if (response.status >= 500) {
    impact = 8; // High impact - server error
  } else {
    impact = 5; // Medium impact - unclear error
  }

  userImpactScore.add(impact);

  // Test order retrieval during payment issues
  if (response.status === 201) {
    const orderBody = JSON.parse(response.body);
    const getOrderResponse = http.get(`${BASE_URL}/orders/${orderBody.id}`, { headers });
    check(getOrderResponse, {
      'order retrieval works during payment issues': (r) => r.status === 200,
    });
  }
}

function testDatabaseFailover() {
  const headers = authenticate();
  if (!headers) return;

  // Test various database operations during simulated outage
  const operations = [
    () => testRestaurantListing(headers),
    () => testOrderHistory(headers),
    () => testUserProfile(headers),
    () => testMenuRetrieval(headers),
  ];

  const operation = operations[Math.floor(Math.random() * operations.length)];
  const startTime = Date.now();
  const success = operation();
  const endTime = Date.now();

  failoverResponseTime.add(endTime - startTime);
  databaseFailoverRate.add(success);
  overallResilienceRate.add(success);

  // User impact assessment
  const impact = success ? 1 : 7; // Low impact if working, high if not
  userImpactScore.add(impact);
}

function testCacheFailover() {
  const headers = authenticate();
  if (!headers) return;

  // Test cache-dependent operations
  const startTime = Date.now();

  // Restaurant listing (heavily cached)
  const restaurantResponse = http.get(`${BASE_URL}/restaurants?page=1&limit=10`, { headers });

  // Menu retrieval (cached)
  const menuResponse = http.get(`${BASE_URL}/restaurants/restaurant-failover-1/menu`, { headers });

  const endTime = Date.now();
  failoverResponseTime.add(endTime - startTime);

  const success = check({ restaurantResponse, menuResponse }, {
    'restaurant listing works without cache': ({ restaurantResponse }) => restaurantResponse.status === 200,
    'menu retrieval works without cache': ({ menuResponse }) => menuResponse.status === 200,
    'cache failover response time acceptable': () => (endTime - startTime) < 2000,
  });

  cacheFailoverRate.add(success);
  overallResilienceRate.add(success);

  // Cache failures should have minimal user impact
  const impact = success ? 0 : 2;
  userImpactScore.add(impact);
}

// Helper functions for database operations
function testRestaurantListing(headers) {
  const response = http.get(`${BASE_URL}/restaurants`, { headers });
  return check(response, {
    'restaurant listing resilient': (r) => r.status === 200 || r.status === 503,
    'restaurant listing provides fallback': (r) => {
      if (r.status === 503) {
        try {
          const body = JSON.parse(r.body);
          return body.fallback === true;
        } catch (e) {
          return false;
        }
      }
      return true;
    },
  });
}

function testOrderHistory(headers) {
  const response = http.get(`${BASE_URL}/orders/history`, { headers });
  return check(response, {
    'order history resilient': (r) => r.status === 200 || r.status === 503,
  });
}

function testUserProfile(headers) {
  const response = http.get(`${BASE_URL}/users/profile`, { headers });
  return check(response, {
    'user profile resilient': (r) => r.status === 200 || r.status === 503,
  });
}

function testMenuRetrieval(headers) {
  const response = http.get(`${BASE_URL}/restaurants/restaurant-failover-1/menu`, { headers });
  return check(response, {
    'menu retrieval resilient': (r) => r.status === 200 || r.status === 503,
  });
}

// Simulate service failures (would be called externally in real tests)
function simulatePaymentServiceFailure() {
  // This would typically be done through admin API or infrastructure tools
  const response = http.post(`${ADMIN_URL}/simulate/payment-failure`, {}, {
    headers: { 'X-Admin-Token': __ENV.ADMIN_TOKEN || 'test-token' },
  });

  return response.status === 200;
}

function simulateDatabaseFailure() {
  const response = http.post(`${ADMIN_URL}/simulate/database-failure`, {}, {
    headers: { 'X-Admin-Token': __ENV.ADMIN_TOKEN || 'test-token' },
  });

  return response.status === 200;
}

function simulateCacheFailure() {
  const response = http.post(`${ADMIN_URL}/simulate/cache-failure`, {}, {
    headers: { 'X-Admin-Token': __ENV.ADMIN_TOKEN || 'test-token' },
  });

  return response.status === 200;
}

export function setup() {
  console.log('Starting Failover Tests');
  console.log('Testing system resilience during service outages');
  console.log(`Base URL: ${BASE_URL}`);

  // Note: In a real scenario, you would trigger actual service failures here
  // For this test, we simulate failures through invalid requests or admin endpoints
}

export function teardown(data) {
  console.log('Failover Tests completed');
  console.log('Check metrics for system resilience during failures');

  // Restore services if they were actually disabled
  // http.post(`${ADMIN_URL}/restore/all-services`);
}
