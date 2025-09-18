# Performance Optimizations

This document outlines the performance optimizations implemented in the SwiftEats backend to meet or exceed SLA targets under heavy load conditions.

## Database Optimizations

### Connection Pooling

- **Enhanced Connection Pool Service**: Implemented in `src/common/services/connection-pool.service.ts`
- **Configurable Pool Size**: Dynamic pool sizing based on load with min/max connections
- **Connection Timeout Management**: Optimized idle timeout and connection timeout settings
- **Pool Metrics Collection**: Real-time monitoring of pool utilization
- **Connection Keepalive**: Prevents connection drops during periods of low activity

### Query Performance

- **Query Performance Monitoring**: Implemented in `src/common/services/query-performance.service.ts`
- **Slow Query Detection**: Automatic identification and logging of slow queries
- **Query Execution Metrics**: Detailed timing for query execution
- **Query Runner Wrapping**: Performance monitoring for all database operations

### Read Replicas

- **Read Replica Service**: Implemented in `src/common/services/read-replica.service.ts`
- **Round-Robin Load Balancing**: Distributes read operations across multiple replicas
- **Automatic Failover**: Retries failed queries on different replicas
- **Connection Management**: Separate connection pools for read replicas

### Index Optimization

- **Index Analysis Service**: Implemented in `src/common/services/index-optimization.service.ts`
- **Unused Index Detection**: Identifies indexes that are not being used
- **Missing Index Identification**: Suggests potential indexes for frequently queried columns
- **Duplicate Index Detection**: Identifies redundant indexes that can be consolidated
- **Index Management Tools**: Scripts for creating and managing indexes (`scripts/optimize-indexes.ts`)

## API Response Optimization

### Response Serialization

- **Optimized Serialization**: Implemented in `src/common/interceptors/response-serialization.interceptor.ts`
- **Efficient Object Transformation**: Uses class-transformer for fast serialization
- **Circular Reference Handling**: Prevents serialization errors with circular object references
- **Selective Property Inclusion**: Excludes private properties from responses
- **Performance Metrics**: Tracks serialization time for large responses

### Response Compression

- **Enhanced Compression Middleware**: Implemented in `src/common/middleware/enhanced-compression.middleware.ts`
- **Brotli Compression**: Uses Brotli compression when available for better compression ratios
- **Configurable Threshold**: Only compresses responses above a certain size
- **Content Type Filtering**: Skips compression for already compressed formats
- **Compression Metrics**: Tracks compression ratios and bandwidth savings

## WebSocket Optimization

- **WebSocket Optimization Service**: Implemented in `src/common/services/websocket-optimization.service.ts`
- **Connection Limits**: Prevents server overload by limiting concurrent connections
- **Ping/Pong Configuration**: Optimized heartbeat intervals for connection stability
- **Message Batching**: Groups multiple small messages into batched transmissions
- **Compression**: Configurable per-message deflate compression for WebSocket messages
- **Rate Limiting**: Protects against connection flooding

## Background Job Processing

- **Job Optimization Service**: Implemented in `src/common/services/job-optimization.service.ts`
- **Concurrency Control**: Configurable worker concurrency based on system resources
- **Job Batching**: Efficiently processes jobs in batches to reduce overhead
- **Retry Strategies**: Exponential backoff for failed jobs
- **Queue Monitoring**: Real-time metrics for queue health and performance
- **Resource Management**: Proper cleanup of resources when shutting down

## System-Wide Optimizations

- **Performance Module**: Centralized performance configuration in `src/modules/performance/performance.module.ts`
- **Health Metrics**: Real-time system health monitoring via `/performance/health` endpoint
- **Database Module**: Optimized TypeORM configuration in `src/modules/database/database.module.ts`
- **Performance Constants**: Centralized performance settings in `src/common/constants/performance.constants.ts`

## Performance Testing

- **Index Optimization Script**: Run with `npm run optimize-indexes` to analyze and optimize database indexes
- **Health Metrics Endpoint**: Access `/performance/health` (admin role required) to view system metrics

## Configuration

Performance settings can be configured through environment variables or the default values in `performance.constants.ts`:

```typescript
// Database connection pool settings
DB_POOL_SIZE=50
DB_POOL_MIN_SIZE=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000
DB_STATEMENT_TIMEOUT=30000
DB_CONNECT_TIMEOUT=10000
DB_RETRY_DELAY=100
DB_MAX_RETRIES=5
DB_SLOW_QUERY_THRESHOLD_MS=100

// WebSocket settings
WS_PING_INTERVAL=25000
WS_PING_TIMEOUT=10000
WS_MAX_HTTP_BUFFER_SIZE=1000000
WS_MAX_CONNECTIONS=10000
WS_ENABLE_COMPRESSION=true

// Compression settings
COMPRESSION_THRESHOLD_BYTES=1024

// Job processing settings
JOB_CONCURRENCY=10
JOB_MAX_STALLED_COUNT=3
JOB_STALLED_INTERVAL=30000
JOB_DEFAULT_ATTEMPTS=3
JOB_BACKOFF_DELAY=1000

// Monitoring settings
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_MONITORING_INTERVAL_MS=300000
API_DETAILED_METRICS=false
API_SERIALIZATION_THRESHOLD_MS=50

// Index optimization settings
DB_ENABLE_INDEX_ANALYSIS=false
DB_INDEX_ANALYSIS_INTERVAL_MS=86400000
```
