# SwiftEats Observability & Monitoring Infrastructure

This document provides an overview of the observability and monitoring infrastructure implemented for the SwiftEats food delivery platform.

## Table of Contents

- [Overview](#overview)
- [Components](#components)
  - [Metrics Collection](#metrics-collection)
  - [Log Aggregation](#log-aggregation)
  - [Distributed Tracing](#distributed-tracing)
  - [Alerting](#alerting)
  - [Dashboards](#dashboards)
  - [System Lag Monitoring](#system-lag-monitoring)
- [Setup Instructions](#setup-instructions)
- [Usage Guidelines](#usage-guidelines)
- [Key Metrics](#key-metrics)
- [Alert Rules](#alert-rules)
- [Troubleshooting](#troubleshooting)

## Overview

The SwiftEats observability and monitoring infrastructure provides comprehensive visibility into the system's health, performance, and business metrics. It follows industry best practices for modern cloud-native applications, implementing the three pillars of observability:

1. **Metrics**: Quantitative measurements collected over time
2. **Logs**: Detailed event records with contextual information
3. **Traces**: Request flows through distributed systems

This infrastructure enables the operations team to:
- Monitor system health in real-time
- Detect and diagnose issues quickly
- Track business KPIs
- Set up alerts for critical conditions
- Analyze performance trends
- Identify optimization opportunities

## Components

### Metrics Collection

**Technology**: Prometheus

Metrics collection is implemented using Prometheus, a powerful open-source monitoring and alerting toolkit. The system collects both system-level and business-specific metrics.

**Key Features**:
- Custom metrics for business KPIs
- HTTP request metrics (count, duration, size)
- Database query metrics
- Cache performance metrics
- System resource metrics (CPU, memory)

**Implementation Details**:
- Located in `src/modules/observability/metrics/`
- `PrometheusService`: Core service for metrics registration and collection
- `MetricsService`: Application-level metrics collection
- `CustomMetricsService`: Business-specific metrics collection

**Configuration**:
- Metrics are exposed at `/metrics` endpoint
- Default collection interval: 15 seconds
- Data retention: 15 days (configurable)

### Log Aggregation

**Technology**: ELK Stack (Elasticsearch, Logstash, Kibana)

Centralized logging is implemented using the ELK stack, providing powerful log storage, processing, and visualization capabilities.

**Key Features**:
- Structured JSON logging
- Centralized log collection
- Full-text search
- Log visualization and dashboards
- Log-based alerting

**Implementation Details**:
- Located in `src/modules/observability/logging/`
- `LoggingService`: Core service for structured logging
- `ElasticsearchLoggerService`: Log shipping to Elasticsearch

**Configuration**:
- Log levels: error, warn, info, debug, verbose
- Bulk log shipping with configurable batch size
- Daily log indices with configurable retention

### Distributed Tracing

**Technology**: Jaeger (OpenTelemetry)

Distributed tracing is implemented using Jaeger with OpenTelemetry instrumentation, providing visibility into request flows across services.

**Key Features**:
- End-to-end request tracing
- Latency measurement at each step
- Dependency visualization
- Root cause analysis
- Performance bottleneck identification

**Implementation Details**:
- Located in `src/modules/observability/tracing/`
- `TracingService`: Core service for span creation and management
- `JaegerTracingService`: Jaeger integration with OpenTelemetry

**Configuration**:
- Sampling rate: 100% for errors, 10% for normal requests (configurable)
- Span processor: Batch processing with 5-second intervals
- Auto-instrumentation for HTTP, Express, NestJS, PostgreSQL, and Redis

### Alerting

**Technology**: Prometheus AlertManager

Alerting is implemented using Prometheus AlertManager, providing flexible alert routing, grouping, and notification capabilities.

**Key Features**:
- Alert definition based on PromQL expressions
- Alert grouping and deduplication
- Multiple notification channels (email, Slack, PagerDuty)
- Silencing and inhibition rules
- Escalation policies

**Implementation Details**:
- Located in `src/modules/observability/alerting/`
- `AlertingService`: Core service for alert creation and management
- `AlertManagerService`: AlertManager integration
- Alert rules defined in `deploy/prometheus/alert-rules.yml`

**Configuration**:
- Default notification channels: email and Slack
- Alert grouping by service and severity
- Configurable alert thresholds

### Dashboards

**Technology**: Grafana

Dashboards are implemented using Grafana, providing powerful visualization and exploration capabilities for metrics and logs.

**Key Features**:
- Pre-configured dashboards for system and business metrics
- Interactive visualizations
- Custom dashboard creation
- Data exploration
- Variable templating

**Implementation Details**:
- Located in `src/modules/observability/dashboards/`
- `DashboardsService`: Service for dashboard provisioning and management
- Dashboard definitions in `deploy/grafana/dashboards/`

**Available Dashboards**:
- System Overview: CPU, memory, HTTP requests, database queries
- Business Metrics: Orders, drivers, restaurants, users
- API Performance: Request rate, duration, errors by endpoint

### System Lag Monitoring

**Technology**: Custom implementation with Prometheus

Real-time system lag monitoring is implemented to track processing delays in various system components.

**Key Features**:
- Order processing lag monitoring
- Driver assignment lag monitoring
- Notification delivery lag monitoring
- Message queue lag monitoring
- Database query lag monitoring
- Event processing lag monitoring

**Implementation Details**:
- Located in `src/modules/observability/metrics/lag-monitoring.service.ts`
- Periodic lag checks with configurable interval
- Lag metrics exposed through Prometheus

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Node.js 20.x or higher
- Kubernetes cluster (for production deployment)

### Local Development Setup

1. Start the observability stack:

```bash
docker-compose -f deploy/docker-compose.observability.yml up -d
```

2. Configure environment variables in `.env`:

```
# Metrics
METRICS_PREFIX=swifteats_
METRICS_PORT=9090

# Logging
ELASTICSEARCH_ENABLED=true
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX_PREFIX=swifteats-logs
ELASTICSEARCH_BULK_SIZE=100
ELASTICSEARCH_FLUSH_INTERVAL=5000

# Tracing
TRACING_ENABLED=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Alerting
ALERTING_ENABLED=true
ALERT_MANAGER_URL=http://localhost:9093/api/v2/alerts

# Lag Monitoring
LAG_MONITORING_ENABLED=true
LAG_CHECK_INTERVAL=15000
```

3. Start the application:

```bash
npm run start:dev
```

### Production Deployment

1. Apply Kubernetes manifests:

```bash
kubectl apply -f deploy/kubernetes/observability/
```

2. Configure environment variables in the deployment manifest.

## Usage Guidelines

### Adding New Metrics

To add a new metric:

1. Choose the appropriate metric type (counter, gauge, histogram, summary)
2. Add the metric to the relevant service (`MetricsService` or `CustomMetricsService`)
3. Initialize the metric in the service's `onModuleInit` method
4. Add methods to record values for the metric

Example:

```typescript
// In custom-metrics.service.ts
private newMetric!: client.Counter<string>;

public onModuleInit(): void {
  // Initialize existing metrics...
  
  this.newMetric = this.prometheusService.createCounter(
    'new_metric_total',
    'Description of the new metric',
    ['label1', 'label2'],
  );
}

public incrementNewMetric(label1: string, label2: string): void {
  this.newMetric.inc({ label1, label2 });
}
```

### Adding New Log Context

To add new context to logs:

```typescript
// Import the LoggingService
private readonly logger: LoggingService

// Log with context
this.logger.logWithContext(
  LogLevel.INFO,
  'Message',
  {
    orderId: '123',
    customerId: '456',
    amount: 29.99,
  },
);
```

### Creating a New Trace

To create a new trace:

```typescript
// Import the TracingService
private readonly tracingService: TracingService

// Create a new span
const span = this.tracingService.startSpan('operation-name');

try {
  // Perform operation
  span.setAttribute('key', 'value');
} catch (error) {
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
  throw error;
} finally {
  span.end();
}
```

### Creating a New Alert

To create a new alert rule:

1. Add the rule to `deploy/prometheus/alert-rules.yml`
2. Reload Prometheus configuration

Example:

```yaml
- alert: NewAlert
  expr: metric_name > threshold
  for: 5m
  labels:
    severity: warning
    service: swifteats-backend
  annotations:
    summary: "Alert summary"
    description: "Detailed description of the alert."
```

## Key Metrics

### System Metrics

- `swifteats_system_memory_usage_bytes`: Memory usage in bytes
- `swifteats_system_cpu_usage_percent`: CPU usage in percent
- `swifteats_http_requests_total`: Total number of HTTP requests
- `swifteats_http_request_duration_seconds`: HTTP request duration in seconds
- `swifteats_db_query_duration_seconds`: Database query duration in seconds

### Business Metrics

- `swifteats_orders_total`: Total number of orders
- `swifteats_order_value_total`: Total value of orders
- `swifteats_order_processing_time_seconds`: Time taken to process an order
- `swifteats_drivers_active`: Number of currently active drivers
- `swifteats_driver_delivery_time_seconds`: Time taken for a driver to deliver an order

### Lag Metrics

- `swifteats_order_processing_lag_seconds`: Lag in order processing
- `swifteats_driver_assignment_lag_seconds`: Lag in driver assignment
- `swifteats_notification_delivery_lag_seconds`: Lag in notification delivery
- `swifteats_message_queue_lag_messages`: Lag in message queue
- `swifteats_event_processing_lag_seconds`: Lag in event processing

## Alert Rules

### System Alerts

- **HighCpuUsage**: CPU usage above 80% for more than 5 minutes
- **HighMemoryUsage**: Memory usage above 2GB for more than 5 minutes
- **InstanceDown**: Instance down for more than 1 minute
- **HighHttpErrorRate**: HTTP error rate above 5% for more than 2 minutes
- **SlowHttpRequests**: 95th percentile of HTTP request duration above 1 second for more than 5 minutes

### Business Alerts

- **HighOrderProcessingTime**: 95th percentile of order processing time above 30 minutes for more than 5 minutes
- **HighDriverDeliveryTime**: 95th percentile of driver delivery time above 30 minutes for more than 5 minutes
- **LowActiveDrivers**: Number of active drivers below 5 for more than 5 minutes

## Troubleshooting

### Common Issues

#### Metrics Not Showing in Grafana

1. Check if Prometheus is running: `curl http://localhost:9090/-/healthy`
2. Check if metrics endpoint is accessible: `curl http://localhost:3000/metrics`
3. Check Prometheus targets: `http://localhost:9090/targets`
4. Verify Prometheus data source in Grafana

#### Logs Not Appearing in Kibana

1. Check if Elasticsearch is running: `curl http://localhost:9200/_cluster/health`
2. Check Elasticsearch indices: `curl http://localhost:9200/_cat/indices`
3. Verify log shipping configuration in `.env`
4. Check for errors in application logs

#### Traces Not Showing in Jaeger

1. Check if Jaeger is running: `curl http://localhost:16686/api/services`
2. Verify tracing configuration in `.env`
3. Check for errors in application logs
4. Ensure sampling is enabled

### Support

For additional support, contact the DevOps team or open an issue in the repository.
