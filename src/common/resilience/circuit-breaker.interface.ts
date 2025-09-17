/**
 * Circuit state enum
 */
export enum CircuitState {
  CLOSED = 'closed',     // Normal operation, requests pass through
  OPEN = 'open',         // Circuit is open, requests fail fast
  HALF_OPEN = 'half_open' // Testing if service is back online
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  
  /** Time window in ms to track failures */
  failureWindowMs: number;
  
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN */
  resetTimeoutMs: number;
  
  /** Number of successful requests needed in HALF_OPEN state to close the circuit */
  successThreshold: number;
  
  /** Optional fallback function to execute when circuit is open */
  fallback?: <T>(error: Error) => Promise<T> | T;
}

/**
 * Circuit breaker interface
 */
export interface ICircuitBreaker {
  /**
   * Execute a function with circuit breaker protection
   * @param circuitId Unique identifier for the circuit
   * @param operation Function to execute
   * @param config Optional circuit breaker configuration
   * @returns Result of the operation if successful
   * @throws Error if circuit is open or operation fails
   */
  executeWithCircuitBreaker<T>(
    circuitId: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T>;
  
  /**
   * Get the current state of a circuit
   * @param circuitId Unique identifier for the circuit
   * @returns Current circuit state
   */
  getCircuitState(circuitId: string): CircuitState;
  
  /**
   * Reset a circuit to closed state
   * @param circuitId Unique identifier for the circuit
   */
  resetCircuit(circuitId: string): void;
}

/**
 * Circuit breaker health check interface
 */
export interface CircuitBreakerHealth {
  circuitId: string;
  state: CircuitState;
  failures: number;
  lastFailure: Date | null;
  lastStateChange: Date;
  config: CircuitBreakerConfig;
}
