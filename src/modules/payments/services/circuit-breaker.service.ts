import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService as CommonCircuitBreakerService } from '../../../common/resilience/circuit-breaker.service';
import { CircuitState, CircuitBreakerConfig } from '../../../common/resilience/circuit-breaker.interface';

/**
 * Payment-specific circuit breaker service that wraps the common circuit breaker
 * Provides payment-specific fallback mechanisms and configurations
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  
  /** Default payment circuit breaker configuration */
  private readonly defaultPaymentConfig: Partial<CircuitBreakerConfig> = {
    failureThreshold: 3,        // More sensitive for payments
    failureWindowMs: 30000,     // 30 seconds
    resetTimeoutMs: 60000,      // 1 minute
    successThreshold: 2,
    fallback: this.paymentFallback.bind(this)
  };

  constructor(private readonly commonCircuitBreaker: CommonCircuitBreakerService) {}

  /**
   * Execute a function with circuit breaker protection
   * @param circuitId Unique identifier for the circuit
   * @param operation Function to execute
   * @param config Optional circuit breaker configuration
   * @returns Result of the operation if successful
   * @throws Error if circuit is open or operation fails
   */
  async executeWithCircuitBreaker<T>(
    circuitId: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    // Prefix circuit ID with 'payment-' to namespace it
    const paymentCircuitId = `payment-${circuitId}`;
    
    // Merge payment-specific defaults with provided config
    const mergedConfig = { ...this.defaultPaymentConfig, ...config };
    
    return this.commonCircuitBreaker.executeWithCircuitBreaker(
      paymentCircuitId,
      operation,
      mergedConfig
    );
  }

  /**
   * Get the current state of a payment circuit
   * @param circuitId Unique identifier for the circuit
   * @returns Current circuit state
   */
  getCircuitState(circuitId: string): CircuitState {
    return this.commonCircuitBreaker.getCircuitState(`payment-${circuitId}`);
  }

  /**
   * Reset a payment circuit to closed state
   * @param circuitId Unique identifier for the circuit
   */
  resetCircuit(circuitId: string): void {
    this.commonCircuitBreaker.resetCircuit(`payment-${circuitId}`);
  }
  
  /**
   * Payment-specific fallback function
   * @param error The error that triggered the fallback
   * @returns A fallback result or throws an error
   */
  private paymentFallback<T>(error: Error): T {
    this.logger.warn(`Payment circuit breaker fallback triggered: ${error.message}`);
    
    // For payments, we generally want to fail safely rather than provide a fallback result
    // This could be customized based on the specific payment operation
    throw new Error(`Payment service unavailable: ${error.message}`);
  }
}
