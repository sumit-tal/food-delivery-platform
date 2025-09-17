# Circuit Breaker Pattern Implementation

## Overview

The circuit breaker pattern is implemented in SwiftEats to improve system resilience when interacting with external services. This pattern prevents cascading failures by failing fast when a service is unavailable and provides automatic recovery mechanisms.

## Architecture

The circuit breaker implementation consists of the following components:

1. **Core Circuit Breaker Service**: Manages circuit state transitions and execution with protection
2. **Circuit Breaker Health Service**: Provides health checking and automatic recovery
3. **Circuit Breaker Monitor Service**: Monitors circuit state changes and provides alerting
4. **Service-Specific Circuit Breakers**: Specialized implementations for different services

## Circuit States

A circuit can be in one of three states:

- **CLOSED**: Normal operation, requests pass through to the service
- **OPEN**: Service is unavailable, requests fail fast without reaching the service
- **HALF_OPEN**: Testing if service has recovered, limited requests pass through

## State Transitions

1. **CLOSED → OPEN**: Occurs when failure threshold is reached within a time window
2. **OPEN → HALF_OPEN**: Occurs after a reset timeout period
3. **HALF_OPEN → CLOSED**: Occurs when success threshold is reached
4. **HALF_OPEN → OPEN**: Occurs on any failure in HALF_OPEN state

## Configuration Options

Each circuit breaker can be configured with the following parameters:

- `failureThreshold`: Number of failures before opening the circuit
- `failureWindowMs`: Time window in milliseconds to track failures
- `resetTimeoutMs`: Time in milliseconds to wait before transitioning from OPEN to HALF_OPEN
- `successThreshold`: Number of successful requests needed in HALF_OPEN state to close the circuit
- `fallback`: Optional function to execute when circuit is open

## Service-Specific Implementations

### Payment Gateway Circuit Breaker

- **Circuit ID Format**: `payment-{operation}-{id}`
- **Default Configuration**:
  - `failureThreshold`: 3
  - `failureWindowMs`: 30000 (30 seconds)
  - `resetTimeoutMs`: 60000 (1 minute)
  - `successThreshold`: 2
- **Fallback Behavior**: Returns a failure response with appropriate error code

### Notification Circuit Breaker

- **Circuit ID Format**: `notification-{channel}`
- **Default Configuration**:
  - `failureThreshold`: 5
  - `failureWindowMs`: 60000 (1 minute)
  - `resetTimeoutMs`: 30000 (30 seconds)
  - `successThreshold`: 2
- **Fallback Behavior**: Returns success with fallback flag, queues notification for retry

## Health Checking and Recovery

The circuit breaker health service automatically checks the health of services with open circuits and resets them when they recover. Health checks are registered per circuit and run on a scheduled basis.

## Monitoring and Alerting

The circuit breaker monitor service provides:

1. **State Change Events**: Emitted when a circuit changes state
2. **Customizable Alerts**: Can be configured per circuit or with a default handler
3. **Metrics**: Emitted for integration with monitoring systems

## Usage Examples

### Basic Usage

```typescript
// Execute with circuit breaker protection
const result = await circuitBreakerService.executeWithCircuitBreaker(
  'service-operation',
  async () => {
    // Call external service
    return await externalService.operation();
  }
);
```

### With Custom Configuration

```typescript
// Execute with custom configuration
const result = await circuitBreakerService.executeWithCircuitBreaker(
  'service-operation',
  async () => {
    // Call external service
    return await externalService.operation();
  },
  {
    failureThreshold: 10,
    resetTimeoutMs: 120000,
    fallback: (error) => {
      // Custom fallback logic
      return { success: false, error: error.message };
    }
  }
);
```

### Registering Health Checks

```typescript
// Register health check for a circuit
circuitBreakerHealthService.registerHealthCheck(
  'payment-gateway',
  async () => {
    try {
      // Simple health check
      await paymentGateway.getStatus();
      return true;
    } catch (error) {
      return false;
    }
  }
);
```

### Registering Alert Handlers

```typescript
// Register alert handler for a circuit
circuitBreakerMonitorService.registerAlertHandler(
  'payment-gateway',
  async (event) => {
    if (event.state === CircuitState.OPEN) {
      // Send alert when circuit opens
      await notificationService.sendAlert(
        'Payment gateway circuit is open',
        `Circuit ${event.circuitId} opened at ${event.timestamp}`
      );
    }
  }
);
```

## Best Practices

1. **Use Namespaced Circuit IDs**: Use a consistent naming convention for circuit IDs
2. **Configure Appropriately**: Adjust thresholds based on service characteristics
3. **Implement Fallbacks**: Always provide fallback behavior for critical services
4. **Register Health Checks**: Enable automatic recovery for all circuits
5. **Monitor Circuit States**: Set up alerts for circuit state changes
6. **Test Circuit Behavior**: Verify that circuits open and close as expected
