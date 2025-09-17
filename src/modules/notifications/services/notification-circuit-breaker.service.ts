import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService as CommonCircuitBreakerService } from '../../../common/resilience/circuit-breaker.service';
import { CircuitState, CircuitBreakerConfig } from '../../../common/resilience/circuit-breaker.interface';

/**
 * Notification-specific circuit breaker service that wraps the common circuit breaker
 * Provides notification-specific fallback mechanisms and configurations
 */
@Injectable()
export class NotificationCircuitBreakerService {
  private readonly logger = new Logger(NotificationCircuitBreakerService.name);
  
  /** Default notification circuit breaker configuration */
  private readonly defaultNotificationConfig: Partial<CircuitBreakerConfig> = {
    failureThreshold: 5,        // Notifications can tolerate more failures
    failureWindowMs: 60000,     // 1 minute
    resetTimeoutMs: 30000,      // 30 seconds
    successThreshold: 2,
    fallback: this.notificationFallback.bind(this)
  };

  constructor(private readonly commonCircuitBreaker: CommonCircuitBreakerService) {}

  /**
   * Execute a function with circuit breaker protection
   * @param channel Notification channel (email, sms, push)
   * @param operation Function to execute
   * @param config Optional circuit breaker configuration
   * @returns Result of the operation if successful
   * @throws Error if circuit is open or operation fails
   */
  async executeWithCircuitBreaker<T>(
    channel: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    // Prefix circuit ID with 'notification-{channel}' to namespace it
    const notificationCircuitId = `notification-${channel}`;
    
    // Merge notification-specific defaults with provided config
    const mergedConfig = { ...this.defaultNotificationConfig, ...config };
    
    return this.commonCircuitBreaker.executeWithCircuitBreaker(
      notificationCircuitId,
      operation,
      mergedConfig
    );
  }

  /**
   * Get the current state of a notification circuit
   * @param channel Notification channel
   * @returns Current circuit state
   */
  getCircuitState(channel: string): CircuitState {
    return this.commonCircuitBreaker.getCircuitState(`notification-${channel}`);
  }

  /**
   * Reset a notification circuit to closed state
   * @param channel Notification channel
   */
  resetCircuit(channel: string): void {
    this.commonCircuitBreaker.resetCircuit(`notification-${channel}`);
  }
  
  /**
   * Notification-specific fallback function
   * @param error The error that triggered the fallback
   * @returns A fallback result or throws an error
   */
  private notificationFallback<T>(error: Error): T {
    this.logger.warn(`Notification circuit breaker fallback triggered: ${error.message}`);
    
    // For notifications, we can return a "success" response to prevent blocking the main flow
    // The actual notification will be queued for retry later
    return {
      success: false,
      error: `Notification service unavailable: ${error.message}`,
      fallback: true
    } as unknown as T;
  }
}
