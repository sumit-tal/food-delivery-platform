# Load Testing & Scaling Verification

This directory contains comprehensive load testing and scaling verification tools for the SwiftEats food delivery platform.

## Overview

The load testing suite is designed to verify that the system meets all performance and reliability requirements, including:

- **Order Processing**: 500 orders per minute capability
- **Real-time Location Updates**: 2,000 updates per second throughput
- **System Resilience**: Failover handling for external service outages
- **Auto-scaling**: Verification of horizontal and vertical scaling capabilities
- **Performance Benchmarks**: Regression testing and performance monitoring

## Tools Used

### k6 (Primary Tool)
- Industry-standard load testing tool
- JavaScript-based test scripts
- Excellent performance metrics and reporting
- WebSocket support for real-time testing

### Artillery (Alternative)
- YAML-based configuration
- Built-in scenarios and phases
- Good for quick load testing setups

## Test Files

### Core Load Tests

1. **`k6-load-test.js`** - Main comprehensive load test
   - Mixed workload simulation
   - User authentication flows
   - Restaurant browsing, ordering, tracking
   - Realistic user behavior patterns

2. **`order-processing-load.js`** - Order processing specific test
   - Target: 500 orders per minute (8.33 orders/second)
   - Realistic order data generation
   - Order creation and retrieval validation
   - Performance thresholds: P95 < 2s, Error rate < 2%

3. **`location-updates-load.js`** - Real-time location updates test
   - Target: 2,000 location updates per second
   - WebSocket and HTTP testing
   - NYC area location simulation
   - Performance thresholds: P95 < 100ms, Error rate < 1%

4. **`failover-tests.js`** - Service outage simulation
   - Payment service failover testing
   - Database failover scenarios
   - Cache failure handling
   - User impact measurement (0-10 scale)

5. **`scaling-verification.js`** - Auto-scaling validation
   - Gradual load increase testing
   - Spike load testing
   - Scaling efficiency metrics
   - Resource utilization monitoring

6. **`performance-monitor.js`** - Continuous performance monitoring
   - Benchmark validation
   - Performance regression detection
   - System metrics collection
   - Detailed performance reporting

### Configuration Files

7. **`artillery-config.yml`** - Artillery load test configuration
   - Multi-phase load testing
   - Scenario-based testing
   - Performance thresholds
   - Metrics publishing to Datadog/Prometheus

8. **`test-data.csv`** - Test data for Artillery
   - User credentials
   - Restaurant IDs
   - Driver information

## Performance Benchmarks

### Order Processing
- **P95 Response Time**: < 1.5 seconds
- **P99 Response Time**: < 3 seconds
- **Error Rate**: < 2%
- **Throughput**: 500 orders/minute (8.33 orders/second)

### Location Updates
- **P95 Response Time**: < 100ms
- **P99 Response Time**: < 200ms
- **Error Rate**: < 1%
- **Throughput**: 2,000 updates/second

### Restaurant Browsing
- **P95 Response Time**: < 300ms
- **P99 Response Time**: < 500ms
- **Error Rate**: < 0.5%

### System Resilience
- **Payment Failover**: 80% operations should still work
- **Database Failover**: 90% operations should work with fallbacks
- **Cache Failover**: 95% operations should work
- **Overall Resilience**: 85% system availability during failures

## Running the Tests

### Prerequisites

1. Install k6:
   ```bash
   # macOS
   brew install k6
   
   # Or download from https://k6.io/docs/getting-started/installation/
   ```

2. Install Artillery (optional):
   ```bash
   npm install -g artillery
   ```

3. Ensure the application is running:
   ```bash
   npm run start:dev
   ```

### Individual Test Execution

```bash
# Main comprehensive load test
npm run test:load

# Order processing load test (500 orders/minute)
npm run test:load:orders

# Location updates load test (2,000 updates/second)
npm run test:load:tracking

# Failover tests
npm run test:load:failover

# Scaling verification
npm run test:load:scaling

# Artillery load test
npm run test:load:artillery

# Combined performance test
npm run test:performance
```

### Custom Test Execution

```bash
# Run with custom parameters
BASE_URL=http://localhost:3000 k6 run test/load/order-processing-load.js

# Run with different target
BASE_URL=https://staging.swifteats.com k6 run test/load/k6-load-test.js

# Run with custom duration
k6 run --duration 30m test/load/scaling-verification.js
```

### Environment Variables

- `BASE_URL`: Application base URL (default: http://localhost:3000)
- `WS_URL`: WebSocket URL (default: ws://localhost:3000)
- `METRICS_URL`: Metrics endpoint URL
- `ADMIN_URL`: Admin API URL for failover simulation
- `ADMIN_TOKEN`: Admin authentication token

## Test Scenarios

### Load Test Scenarios

1. **Warm-up Phase** (2 minutes)
   - 10 concurrent users
   - Basic functionality validation

2. **Normal Load** (5 minutes)
   - 50 concurrent users
   - Mixed operations (browse, order, track)

3. **Peak Load** (5 minutes)
   - 100 concurrent users
   - Stress testing all endpoints

4. **Cool Down** (2 minutes)
   - Return to baseline load

### Scaling Test Scenarios

1. **Gradual Scaling**
   - 10 → 50 → 150 → 300 → 500 users
   - Monitor auto-scaling behavior
   - Measure scaling efficiency

2. **Spike Testing**
   - Sudden load increase: 10 → 200 users
   - Rapid scaling validation
   - Recovery time measurement

### Failover Test Scenarios

1. **Payment Service Outage**
   - Simulate payment gateway failures
   - Test backup payment methods
   - Measure user impact

2. **Database Failover**
   - Primary database unavailability
   - Read replica failover
   - Data consistency validation

3. **Cache Failure**
   - Redis cache unavailability
   - Database fallback performance
   - Cache warming strategies

## Metrics and Monitoring

### Key Performance Indicators (KPIs)

- **Response Time Percentiles**: P50, P95, P99
- **Throughput**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Concurrent Users**: Active user sessions
- **Resource Utilization**: CPU, Memory, Network

### Custom Metrics

- **Order Success Rate**: Percentage of successful orders
- **Location Update Latency**: Real-time update delays
- **Scaling Efficiency**: Performance improvement vs resource increase
- **User Impact Score**: 0-10 scale for service degradation
- **Failover Recovery Time**: Time to restore service

### Monitoring Integration

The tests support integration with:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Real-time dashboards and visualization
- **Datadog**: APM and infrastructure monitoring
- **New Relic**: Application performance monitoring

## CI/CD Integration

### GitHub Actions Integration

The load tests can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/load-test.yml
name: Load Testing
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run Load Tests
        run: |
          npm run test:performance
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
```

### Performance Regression Detection

Automated performance regression detection:

1. **Baseline Establishment**: Store performance metrics from stable releases
2. **Threshold Monitoring**: Alert on performance degradation > 10%
3. **Trend Analysis**: Track performance trends over time
4. **Automated Rollback**: Trigger rollback on critical performance issues

## Troubleshooting

### Common Issues

1. **High Error Rates**
   - Check application logs for errors
   - Verify database connections
   - Monitor resource utilization

2. **Poor Performance**
   - Check for database query optimization
   - Verify caching configuration
   - Monitor network latency

3. **Scaling Issues**
   - Verify auto-scaling configuration
   - Check resource limits
   - Monitor container orchestration

### Debug Mode

Run tests with debug information:

```bash
# Enable debug logging
K6_LOG_LEVEL=debug k6 run test/load/order-processing-load.js

# Verbose output
k6 run --verbose test/load/k6-load-test.js
```

## Best Practices

### Test Design

1. **Realistic Data**: Use production-like test data
2. **User Behavior**: Simulate realistic user patterns
3. **Think Time**: Include appropriate delays between requests
4. **Data Cleanup**: Clean up test data after execution

### Performance Testing

1. **Baseline First**: Establish performance baselines
2. **Incremental Load**: Gradually increase load
3. **Monitor Resources**: Watch CPU, memory, database performance
4. **Test Isolation**: Run tests in isolated environments

### Continuous Testing

1. **Regular Execution**: Run load tests regularly
2. **Performance Budgets**: Set and enforce performance budgets
3. **Trend Monitoring**: Track performance trends over time
4. **Alert Thresholds**: Set up alerts for performance degradation

## Results Analysis

### Performance Reports

Each test generates detailed performance reports including:

- Response time distributions
- Throughput measurements
- Error rate analysis
- Resource utilization metrics
- Scaling efficiency scores

### Report Formats

- **Console Output**: Real-time metrics during test execution
- **JSON Reports**: Detailed metrics for programmatic analysis
- **HTML Reports**: Visual reports with charts and graphs
- **CSV Exports**: Raw data for custom analysis

## Maintenance

### Regular Updates

1. **Test Data Refresh**: Update test data regularly
2. **Scenario Updates**: Modify scenarios based on usage patterns
3. **Threshold Adjustments**: Update performance thresholds as system improves
4. **Tool Updates**: Keep testing tools updated to latest versions

### Performance Optimization

Based on load test results, consider:

1. **Database Optimization**: Index optimization, query tuning
2. **Caching Strategy**: Cache hit ratio improvement
3. **API Optimization**: Response payload optimization
4. **Infrastructure Scaling**: Resource allocation adjustments

## Support

For questions or issues with load testing:

1. Check the troubleshooting section above
2. Review application logs during test execution
3. Monitor system resources during tests
4. Consult the team's performance engineering guidelines
