import { Injectable, Logger } from '@nestjs/common';

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
}

/**
 * Circuit breaker implementation for handling service failures
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, CircuitData> = new Map();
  
  /** Default circuit breaker configuration */
  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    failureWindowMs: 60000, // 1 minute
    resetTimeoutMs: 30000,  // 30 seconds
    successThreshold: 2
  };

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
    // Get or create circuit data
    const circuit = this.getOrCreateCircuit(circuitId, config);
    
    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      // Check if reset timeout has elapsed
      if (Date.now() - circuit.lastStateChange >= circuit.config.resetTimeoutMs) {
        this.transitionToHalfOpen(circuit);
      } else {
        this.logger.warn(`Circuit ${circuitId} is OPEN. Fast failing request.`);
        throw new Error(`Service unavailable: circuit ${circuitId} is open`);
      }
    }
    
    try {
      // Execute the operation
      const result = await operation();
      
      // Handle success
      this.handleSuccess(circuit);
      
      return result;
    } catch (error) {
      // Handle failure
      this.handleFailure(circuit, error as Error);
      throw error;
    }
  }

  /**
   * Get the current state of a circuit
   * @param circuitId Unique identifier for the circuit
   * @returns Current circuit state
   */
  getCircuitState(circuitId: string): CircuitState {
    return this.circuits.get(circuitId)?.state || CircuitState.CLOSED;
  }

  /**
   * Reset a circuit to closed state
   * @param circuitId Unique identifier for the circuit
   */
  resetCircuit(circuitId: string): void {
    const circuit = this.circuits.get(circuitId);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failures = [];
      circuit.successCount = 0;
      circuit.lastStateChange = Date.now();
      this.logger.log(`Circuit ${circuitId} manually reset to CLOSED state`);
    }
  }

  /**
   * Get or create circuit data
   * @param circuitId Unique identifier for the circuit
   * @param config Optional circuit breaker configuration
   * @returns Circuit data
   */
  private getOrCreateCircuit(
    circuitId: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitData {
    if (!this.circuits.has(circuitId)) {
      this.circuits.set(circuitId, {
        state: CircuitState.CLOSED,
        failures: [],
        successCount: 0,
        lastStateChange: Date.now(),
        config: { ...this.defaultConfig, ...config }
      });
    }
    
    return this.circuits.get(circuitId)!;
  }

  /**
   * Handle successful operation
   * @param circuit Circuit data
   */
  private handleSuccess(circuit: CircuitData): void {
    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successCount++;
      
      if (circuit.successCount >= circuit.config.successThreshold) {
        circuit.state = CircuitState.CLOSED;
        circuit.failures = [];
        circuit.successCount = 0;
        circuit.lastStateChange = Date.now();
        this.logger.log(`Circuit transitioned from HALF_OPEN to CLOSED after ${circuit.config.successThreshold} successful requests`);
      }
    }
    
    // In CLOSED state, we just continue normal operation
  }

  /**
   * Handle operation failure
   * @param circuit Circuit data
   * @param error Error that occurred
   */
  private handleFailure(circuit: CircuitData, error: Error): void {
    const now = Date.now();
    
    if (circuit.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN state opens the circuit again
      circuit.state = CircuitState.OPEN;
      circuit.lastStateChange = now;
      circuit.successCount = 0;
      this.logger.warn(`Circuit transitioned from HALF_OPEN to OPEN due to failure: ${error.message}`);
      return;
    }
    
    // Add failure to the list
    circuit.failures.push(now);
    
    // Remove failures outside the window
    const windowStart = now - circuit.config.failureWindowMs;
    circuit.failures = circuit.failures.filter(time => time >= windowStart);
    
    // Check if failure threshold is reached
    if (circuit.state === CircuitState.CLOSED && 
        circuit.failures.length >= circuit.config.failureThreshold) {
      circuit.state = CircuitState.OPEN;
      circuit.lastStateChange = now;
      this.logger.warn(`Circuit transitioned from CLOSED to OPEN after ${circuit.failures.length} failures in ${circuit.config.failureWindowMs}ms`);
    }
  }

  /**
   * Transition circuit to half-open state
   * @param circuit Circuit data
   */
  private transitionToHalfOpen(circuit: CircuitData): void {
    circuit.state = CircuitState.HALF_OPEN;
    circuit.lastStateChange = Date.now();
    circuit.successCount = 0;
    this.logger.log(`Circuit transitioned from OPEN to HALF_OPEN`);
  }
}

/**
 * Internal circuit data interface
 */
interface CircuitData {
  /** Current state of the circuit */
  state: CircuitState;
  
  /** Timestamps of recent failures */
  failures: number[];
  
  /** Count of consecutive successes in HALF_OPEN state */
  successCount: number;
  
  /** Timestamp of last state change */
  lastStateChange: number;
  
  /** Circuit breaker configuration */
  config: CircuitBreakerConfig;
}
