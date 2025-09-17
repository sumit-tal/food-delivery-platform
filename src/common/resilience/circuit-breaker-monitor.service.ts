import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CircuitState } from './circuit-breaker.interface';

/**
 * Circuit state change event interface
 */
interface CircuitStateChangeEvent {
  circuitId: string;
  state: CircuitState;
  timestamp: Date;
}

/**
 * Service for monitoring circuit breaker state changes
 * Provides alerting when circuits open or close
 */
@Injectable()
export class CircuitBreakerMonitorService implements OnModuleInit {
  private readonly logger = new Logger(CircuitBreakerMonitorService.name);
  
  // Map of circuit IDs to alert handlers
  private readonly alertHandlers: Map<string, (event: CircuitStateChangeEvent) => Promise<void>> = new Map();
  
  // Default alert handler
  private defaultAlertHandler: ((event: CircuitStateChangeEvent) => Promise<void>) | null = null;
  
  constructor(private readonly eventEmitter: EventEmitter2) {}
  
  /**
   * Initialize the monitor service
   */
  onModuleInit(): void {
    this.logger.log('Circuit breaker monitor service initialized');
    
    // Set up default alert handler
    this.setDefaultAlertHandler((event) => {
      this.logger.warn(
        `Circuit ${event.circuitId} state changed to ${event.state} at ${event.timestamp.toISOString()}`
      );
      return Promise.resolve();
    });
  }
  
  /**
   * Handle circuit state change events
   * @param event Circuit state change event
   */
  @OnEvent('circuit.state.change')
  async handleCircuitStateChange(event: CircuitStateChangeEvent): Promise<void> {
    this.logger.debug(`Circuit state change detected: ${JSON.stringify(event)}`);
    
    // Get circuit-specific alert handler or use default
    const handler = this.alertHandlers.get(event.circuitId) || this.defaultAlertHandler;
    
    if (handler) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          `Error handling circuit state change alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined
        );
      }
    }
    
    // Emit metrics event for monitoring systems
    this.emitMetrics(event);
  }
  
  /**
   * Register an alert handler for a specific circuit
   * @param circuitId Circuit identifier
   * @param handler Alert handler function
   */
  registerAlertHandler(
    circuitId: string, 
    handler: (event: CircuitStateChangeEvent) => Promise<void>
  ): void {
    this.alertHandlers.set(circuitId, handler);
    this.logger.log(`Registered alert handler for circuit: ${circuitId}`);
  }
  
  /**
   * Remove an alert handler for a circuit
   * @param circuitId Circuit identifier
   */
  removeAlertHandler(circuitId: string): void {
    this.alertHandlers.delete(circuitId);
    this.logger.log(`Removed alert handler for circuit: ${circuitId}`);
  }
  
  /**
   * Set the default alert handler for all circuits
   * @param handler Default alert handler function
   */
  setDefaultAlertHandler(handler: (event: CircuitStateChangeEvent) => Promise<void>): void {
    this.defaultAlertHandler = handler;
    this.logger.log('Set default circuit alert handler');
  }
  
  /**
   * Emit metrics for monitoring systems
   * @param event Circuit state change event
   */
  private emitMetrics(event: CircuitStateChangeEvent): void {
    // In a real implementation, this would integrate with a metrics system
    // like Prometheus, StatsD, or a custom metrics service
    
    // Example metric: circuit_state{circuit_id="payment-gateway", state="open"} 1
    const metricValue = event.state === CircuitState.OPEN ? 1 : 0;
    
    this.logger.debug(`Emitting metric: circuit_state{circuit_id="${event.circuitId}", state="open"} ${metricValue}`);
    
    // Emit event for metrics collectors
    this.eventEmitter.emit('metrics.circuit.state', {
      name: 'circuit_state',
      value: metricValue,
      tags: {
        circuit_id: event.circuitId,
        state: event.state
      },
      timestamp: event.timestamp
    });
  }
}
