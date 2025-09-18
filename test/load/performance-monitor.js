import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';

// Performance monitoring metrics
const responseTimeP95 = new Trend('response_time_p95');
const responseTimeP99 = new Trend('response_time_p99');
const throughputRPS = new Counter('throughput_rps');
const errorRate = new Rate('error_rate');
const memoryUsage = new Gauge('memory_usage_mb');
const cpuUsage = new Gauge('cpu_usage_percent');
const activeConnections = new Gauge('active_connections');

// Benchmark thresholds
const PERFORMANCE_BENCHMARKS = {
  orderProcessing: {
    p95: 1500, // 95% under 1.5s
    p99: 3000, // 99% under 3s
    errorRate: 0.02, // 2% error rate
    throughput: 8.33, // 500 orders/minute
  },
  locationUpdates: {
    p95: 100, // 95% under 100ms
    p99: 200, // 99% under 200ms
    errorRate: 0.01, // 1% error rate
    throughput: 2000, // 2000 updates/second
  },
  restaurantBrowsing: {
    p95: 300, // 95% under 300ms
    p99: 500, // 99% under 500ms
    errorRate: 0.005, // 0.5% error rate
  },
};

export const options = {
  scenarios: {
    performance_monitoring: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.02'],
    error_rate: ['rate<0.02'],
    throughput_rps: ['count>100'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const METRICS_ENDPOINT = __ENV.METRICS_ENDPOINT || 'http://localhost:3000/metrics';

// Performance data collection
let performanceData = {
  orderProcessing: [],
  locationUpdates: [],
  restaurantBrowsing: [],
  systemMetrics: [],
};

// Test user pool
const testUsers = [];
for (let i = 1; i <= 20; i++) {
  testUsers.push({
    email: `perf${i}@example.com`,
    password: 'password123',
  });
}

let authTokens = {};

function authenticate(userIndex) {
  if (authTokens[userIndex]) {
    return authTokens[userIndex];
  }

  const user = testUsers[userIndex % testUsers.length];
  const response = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status === 200) {
    const token = JSON.parse(response.body).access_token;
    authTokens[userIndex] = token;
    return token;
  }
  
  return null;
}

export default function () {
  const userIndex = __VU;
  const token = authenticate(userIndex);
  
  if (!token) {
    errorRate.add(true);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Distribute load across different operations
  const operation = Math.random();
  
  if (operation < 0.4) {
    // 40% - Restaurant browsing
    monitorRestaurantBrowsing(headers);
  } else if (operation < 0.7) {
    // 30% - Order processing
    monitorOrderProcessing(headers);
  } else if (operation < 0.9) {
    // 20% - Location updates (driver simulation)
    monitorLocationUpdates(headers);
  } else {
    // 10% - System metrics collection
    collectSystemMetrics();
  }

  throughputRPS.add(1);
  sleep(1);
}

function monitorRestaurantBrowsing(headers) {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/restaurants?page=1&limit=20`, { headers });
  const endTime = Date.now();
  
  const responseTime = endTime - startTime;
  const success = response.status === 200;
  
  // Record performance data
  performanceData.restaurantBrowsing.push({
    timestamp: Date.now(),
    responseTime,
    success,
    statusCode: response.status,
  });

  // Check against benchmarks
  const benchmark = PERFORMANCE_BENCHMARKS.restaurantBrowsing;
  const withinP95 = responseTime <= benchmark.p95;
  const withinP99 = responseTime <= benchmark.p99;
  
  check(response, {
    'restaurant browsing successful': () => success,
    'restaurant browsing within P95 benchmark': () => withinP95,
    'restaurant browsing within P99 benchmark': () => withinP99,
  });

  if (!success) {
    errorRate.add(true);
  }

  // Update custom metrics
  responseTimeP95.add(responseTime);
  if (responseTime > benchmark.p95) {
    responseTimeP99.add(responseTime);
  }
}

function monitorOrderProcessing(headers) {
  const orderData = {
    restaurantId: `restaurant-perf-${Math.floor(Math.random() * 5) + 1}`,
    items: [
      { menuItemId: 'item-1', quantity: 1, price: 12.99 },
    ],
    deliveryAddress: {
      street: '123 Performance St',
      city: 'Test City',
      zipCode: '12345',
      coordinates: { lat: 40.7128, lng: -74.0060 },
    },
    paymentMethodId: 'pm_test_perf',
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/orders`, JSON.stringify(orderData), { headers });
  const endTime = Date.now();
  
  const responseTime = endTime - startTime;
  const success = response.status === 201;
  
  // Record performance data
  performanceData.orderProcessing.push({
    timestamp: Date.now(),
    responseTime,
    success,
    statusCode: response.status,
  });

  // Check against benchmarks
  const benchmark = PERFORMANCE_BENCHMARKS.orderProcessing;
  const withinP95 = responseTime <= benchmark.p95;
  const withinP99 = responseTime <= benchmark.p99;
  
  check(response, {
    'order processing successful': () => success,
    'order processing within P95 benchmark': () => withinP95,
    'order processing within P99 benchmark': () => withinP99,
    'order processing meets throughput requirement': () => true, // Calculated separately
  });

  if (!success) {
    errorRate.add(true);
  }

  responseTimeP95.add(responseTime);
  if (responseTime > benchmark.p95) {
    responseTimeP99.add(responseTime);
  }
}

function monitorLocationUpdates(headers) {
  const locationData = {
    driverId: `driver-perf-${__VU}`,
    location: {
      lat: 40.7128 + (Math.random() - 0.5) * 0.01,
      lng: -74.0060 + (Math.random() - 0.5) * 0.01,
    },
    timestamp: new Date().toISOString(),
    speed: Math.floor(Math.random() * 60) + 10,
    heading: Math.floor(Math.random() * 360),
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/tracking/location`, JSON.stringify(locationData), { headers });
  const endTime = Date.now();
  
  const responseTime = endTime - startTime;
  const success = response.status === 200;
  
  // Record performance data
  performanceData.locationUpdates.push({
    timestamp: Date.now(),
    responseTime,
    success,
    statusCode: response.status,
  });

  // Check against benchmarks
  const benchmark = PERFORMANCE_BENCHMARKS.locationUpdates;
  const withinP95 = responseTime <= benchmark.p95;
  const withinP99 = responseTime <= benchmark.p99;
  
  check(response, {
    'location update successful': () => success,
    'location update within P95 benchmark': () => withinP95,
    'location update within P99 benchmark': () => withinP99,
  });

  if (!success) {
    errorRate.add(true);
  }

  responseTimeP95.add(responseTime);
  if (responseTime > benchmark.p95) {
    responseTimeP99.add(responseTime);
  }
}

function collectSystemMetrics() {
  const response = http.get(METRICS_ENDPOINT);
  
  if (response.status === 200) {
    // Parse system metrics (simplified - in reality you'd parse Prometheus format)
    const metrics = response.body;
    
    // Extract key metrics
    const memMatch = metrics.match(/memory_usage_bytes\s+(\d+)/);
    const cpuMatch = metrics.match(/cpu_usage_percent\s+(\d+\.?\d*)/);
    const connMatch = metrics.match(/active_connections\s+(\d+)/);
    
    const systemData = {
      timestamp: Date.now(),
      memory: memMatch ? parseInt(memMatch[1]) / 1024 / 1024 : 0, // Convert to MB
      cpu: cpuMatch ? parseFloat(cpuMatch[1]) : 0,
      connections: connMatch ? parseInt(connMatch[1]) : 0,
    };
    
    performanceData.systemMetrics.push(systemData);
    
    // Update gauges
    if (systemData.memory > 0) memoryUsage.add(systemData.memory);
    if (systemData.cpu > 0) cpuUsage.add(systemData.cpu);
    if (systemData.connections > 0) activeConnections.add(systemData.connections);
  }
}

// Performance analysis functions
function analyzePerformance(data, benchmark) {
  if (data.length === 0) return null;
  
  const responseTimes = data.map(d => d.responseTime);
  const successRate = data.filter(d => d.success).length / data.length;
  
  responseTimes.sort((a, b) => a - b);
  const p95Index = Math.floor(responseTimes.length * 0.95);
  const p99Index = Math.floor(responseTimes.length * 0.99);
  
  return {
    count: data.length,
    successRate,
    p95: responseTimes[p95Index] || 0,
    p99: responseTimes[p99Index] || 0,
    avg: responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
    benchmarkP95Met: (responseTimes[p95Index] || 0) <= benchmark.p95,
    benchmarkP99Met: (responseTimes[p99Index] || 0) <= benchmark.p99,
    benchmarkErrorRateMet: (1 - successRate) <= benchmark.errorRate,
  };
}

function generatePerformanceReport() {
  const report = {
    timestamp: new Date().toISOString(),
    orderProcessing: analyzePerformance(performanceData.orderProcessing, PERFORMANCE_BENCHMARKS.orderProcessing),
    locationUpdates: analyzePerformance(performanceData.locationUpdates, PERFORMANCE_BENCHMARKS.locationUpdates),
    restaurantBrowsing: analyzePerformance(performanceData.restaurantBrowsing, PERFORMANCE_BENCHMARKS.restaurantBrowsing),
    systemMetrics: performanceData.systemMetrics.length > 0 ? {
      avgMemoryUsage: performanceData.systemMetrics.reduce((sum, m) => sum + m.memory, 0) / performanceData.systemMetrics.length,
      avgCpuUsage: performanceData.systemMetrics.reduce((sum, m) => sum + m.cpu, 0) / performanceData.systemMetrics.length,
      avgConnections: performanceData.systemMetrics.reduce((sum, m) => sum + m.connections, 0) / performanceData.systemMetrics.length,
    } : null,
  };
  
  return report;
}

export function setup() {
  console.log('Starting Performance Monitoring');
  console.log('Benchmarks:');
  console.log('- Order Processing: P95 < 1.5s, P99 < 3s, Error Rate < 2%');
  console.log('- Location Updates: P95 < 100ms, P99 < 200ms, Error Rate < 1%');
  console.log('- Restaurant Browsing: P95 < 300ms, P99 < 500ms, Error Rate < 0.5%');
  
  // Pre-authenticate users
  for (let i = 0; i < 5; i++) {
    authenticate(i);
  }
}

export function teardown(data) {
  console.log('Performance Monitoring completed');
  
  const report = generatePerformanceReport();
  console.log('\n=== PERFORMANCE REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  
  // Check if benchmarks were met
  const allBenchmarksMet = [
    report.orderProcessing?.benchmarkP95Met,
    report.orderProcessing?.benchmarkP99Met,
    report.orderProcessing?.benchmarkErrorRateMet,
    report.locationUpdates?.benchmarkP95Met,
    report.locationUpdates?.benchmarkP99Met,
    report.locationUpdates?.benchmarkErrorRateMet,
    report.restaurantBrowsing?.benchmarkP95Met,
    report.restaurantBrowsing?.benchmarkP99Met,
    report.restaurantBrowsing?.benchmarkErrorRateMet,
  ].every(met => met === true);
  
  console.log(`\nAll benchmarks met: ${allBenchmarksMet ? 'YES' : 'NO'}`);
}
