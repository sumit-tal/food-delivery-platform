import { Injectable, Logger } from '@nestjs/common';
import { 
  CircuitBreakerConfig, 
  CircuitState, 
  ICircuitBreaker,
  CircuitBreakerHealth
} from './circuit-breaker.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

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

/**
 * Circuit breaker implementation for handling service failures
 */
@Injectable()
export class CircuitBreakerService implements ICircuitBreaker {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, CircuitData> = new Map();
  
  /** Default circuit breaker configuration */
  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    failureWindowMs: 60000, // 1 minute
    resetTimeoutMs: 30000,  // 30 seconds
    successThreshold: 2
  };

  constructor(private readonly eventEmitter: EventEmitter2) {}

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
    
    // Handle open circuit state
    if (circuit.state === CircuitState.OPEN) {
      return this.handleOpenCircuit(circuit, circuitId);
    }
    
    return this.executeOperation(operation, circuit, circuitId);
  }
  
  /**
   * Execute the operation with circuit breaker protection
   * @param operation Function to execute
   * @param circuit Circuit data
   * @param circuitId Circuit identifier
   * @returns Result of the operation
   */
  private async executeOperation<T>(
    operation: () => Promise<T>,
    circuit: CircuitData,
    circuitId: string
  ): Promise<T> {
    try {
      const result = await operation();
      this.handleSuccess(circuit, circuitId);
      return result;
    } catch (error) {
      this.handleFailure(circuit, error as Error, circuitId);
      
      if (circuit.config.fallback) {
        return circuit.config.fallback(error as Error);
      }
      
      throw error;
    }
  }
  
  /**
   * Handle open circuit state
   * @param circuit Circuit data
   * @param circuitId Circuit identifier
   * @returns Result from fallback or throws error
   */
  private async handleOpenCircuit<T>(circuit: CircuitData, circuitId: string): Promise<T> {
    // Check if reset timeout has elapsed
    if (Date.now() - circuit.lastStateChange >= circuit.config.resetTimeoutMs) {
      this.transitionToHalfOpen(circuit);
      // Continue with operation after transition
      return null as unknown as T; // Will be overwritten by retry
    } 
    
    this.logger.warn(`Circuit ${circuitId} is OPEN. Fast failing request.`);
    
    // Emit circuit breaker event
    this.emitCircuitEvent(circuitId, circuit.state);
    
    // Use fallback if provided
    if (circuit.config.fallback) {
      return circuit.config.fallback(new Error(`Service unavailable: circuit ${circuitId} is open`));
    }
    
    throw new Error(`Service unavailable: circuit ${circuitId} is open`);
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
      const wasOpen = circuit.state !== CircuitState.CLOSED;
      circuit.state = CircuitState.CLOSED;
      circuit.failures = [];
      circuit.successCount = 0;
      circuit.lastStateChange = Date.now();
      this.logger.log(`Circuit ${circuitId} manually reset to CLOSED state`);
      
      // Emit circuit state change event
      if (wasOpen) {
        this.emitCircuitEvent(circuitId, CircuitState.CLOSED);
      }
    }
  }

  /**
   * Get health information for all circuits
   * @returns Array of circuit health information
   */
  getCircuitHealth(): CircuitBreakerHealth[] {
    const health: CircuitBreakerHealth[] = [];
    
    this.circuits.forEach((data, circuitId) => {
      health.push({
        circuitId,
        state: data.state,
        failures: data.failures.length,
        lastFailure: data.failures.length > 0 ? new Date(Math.max(...data.failures)) : null,
        lastStateChange: new Date(data.lastStateChange),
        config: data.config
      });
    });
    
    return health;
  }

  /**
   * Get health information for a specific circuit
   * @param circuitId Unique identifier for the circuit
   * @returns Circuit health information or null if not found
   */
  getCircuitHealthById(circuitId: string): CircuitBreakerHealth | null {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) {
      return null;
    }
    
    return {
      circuitId,
      state: circuit.state,
      failures: circuit.failures.length,
      lastFailure: circuit.failures.length > 0 ? new Date(Math.max(...circuit.failures)) : null,
      lastStateChange: new Date(circuit.lastStateChange),
      config: circuit.config
    };
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
   * @param circuitId Circuit identifier
   */
  private handleSuccess(circuit: CircuitData, circuitId: string): void {
    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successCount++;
      
      if (circuit.successCount >= circuit.config.successThreshold) {
        this.closeCircuit(circuit, circuitId);
      }
    }
    // In CLOSED state, we just continue normal operation
  }
  
  /**
   * Close the circuit after successful recovery
   * @param circuit Circuit data
   * @param circuitId Circuit identifier
   */
  private closeCircuit(circuit: CircuitData, circuitId: string): void {
    circuit.state = CircuitState.CLOSED;
    circuit.failures = [];
    circuit.successCount = 0;
    circuit.lastStateChange = Date.now();
    this.logger.log(`Circuit ${circuitId} transitioned from HALF_OPEN to CLOSED after ${circuit.config.successThreshold} successful requests`);
    
    // Emit circuit state change event
    this.emitCircuitEvent(circuitId, CircuitState.CLOSED);
  }

  /**
   * Handle operation failure
   * @param circuit Circuit data
   * @param error Error that occurred
   * @param circuitId Circuit identifier
   */
  private handleFailure(circuit: CircuitData, error: Error, circuitId: string): void {
    const now = Date.now();
    
    if (circuit.state === CircuitState.HALF_OPEN) {
      this.openCircuitFromHalfOpen(circuit, circuitId, error, now);
      return;
    }
    
    this.trackFailureInClosedState(circuit, circuitId, now);
  }
  
  /**
   * Open circuit from half-open state on failure
   * @param circuit Circuit data
   * @param circuitId Circuit identifier
   * @param error Error that occurred
   * @param timestamp Current timestamp
   */
  private openCircuitFromHalfOpen(circuit: CircuitData, circuitId: string, error: Error, timestamp: number): void {
    circuit.state = CircuitState.OPEN;
    circuit.lastStateChange = timestamp;
    circuit.successCount = 0;
    this.logger.warn(`Circuit ${circuitId} transitioned from HALF_OPEN to OPEN due to failure: ${error.message}`);
    
    // Emit circuit state change event
    this.emitCircuitEvent(circuitId, CircuitState.OPEN);
  }
  
  /**
   * Track failure in closed state and open circuit if threshold reached
   * @param circuit Circuit data
   * @param circuitId Circuit identifier
   * @param timestamp Current timestamp
   */
  private trackFailureInClosedState(circuit: CircuitData, circuitId: string, timestamp: number): void {
    // Add failure to the list
    circuit.failures.push(timestamp);
    
    // Remove failures outside the window
    const windowStart = timestamp - circuit.config.failureWindowMs;
    circuit.failures = circuit.failures.filter(time => time >= windowStart);
    
    // Check if failure threshold is reached
    if (circuit.state === CircuitState.CLOSED && 
        circuit.failures.length >= circuit.config.failureThreshold) {
      circuit.state = CircuitState.OPEN;
      circuit.lastStateChange = timestamp;
      this.logger.warn(`Circuit ${circuitId} transitioned from CLOSED to OPEN after ${circuit.failures.length} failures in ${circuit.config.failureWindowMs}ms`);
      
      // Emit circuit state change event
      this.emitCircuitEvent(circuitId, CircuitState.OPEN);
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

  /**
   * Emit circuit state change event
   * @param circuitId Circuit identifier
   * @param state New circuit state
   */
  private emitCircuitEvent(circuitId: string, state: CircuitState): void {
    this.eventEmitter.emit('circuit.state.change', {
      circuitId,
      state,
      timestamp: new Date()
    });
  }
}
