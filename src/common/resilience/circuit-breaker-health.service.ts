import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitState } from './circuit-breaker.interface';

/**
 * Service for monitoring and managing circuit breaker health
 * Provides automatic health checking and recovery for circuit breakers
 */
@Injectable()
export class CircuitBreakerHealthService {
  private readonly logger = new Logger(CircuitBreakerHealthService.name);
  
  // Map of circuit IDs to health check functions
  private readonly healthChecks: Map<string, () => Promise<boolean>> = new Map();
  
  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  /**
   * Register a health check for a circuit
   * @param circuitId Circuit identifier
   * @param healthCheck Function that returns true if the service is healthy
   */
  registerHealthCheck(circuitId: string, healthCheck: () => Promise<boolean>): void {
    this.healthChecks.set(circuitId, healthCheck);
    this.logger.log(`Registered health check for circuit: ${circuitId}`);
  }

  /**
   * Remove a health check for a circuit
   * @param circuitId Circuit identifier
   */
  removeHealthCheck(circuitId: string): void {
    this.healthChecks.delete(circuitId);
    this.logger.log(`Removed health check for circuit: ${circuitId}`);
  }

  /**
   * Run health checks for all open circuits
   * This is scheduled to run every minute
   */
  @Cron('*/1 * * * *')
  async runHealthChecks(): Promise<void> {
    this.logger.debug('Running circuit breaker health checks');
    
    const circuits = this.circuitBreakerService.getCircuitHealth();
    
    // Filter for open circuits that have health checks
    const openCircuits = circuits.filter(circuit => 
      circuit.state === CircuitState.OPEN && 
      this.healthChecks.has(circuit.circuitId)
    );
    
    if (openCircuits.length === 0) {
      this.logger.debug('No open circuits with health checks found');
      return;
    }
    
    this.logger.log(`Found ${openCircuits.length} open circuits with health checks`);
    
    // Run health checks for each open circuit
    for (const circuit of openCircuits) {
      await this.checkCircuitHealth(circuit.circuitId);
    }
  }

  /**
   * Check health for a specific circuit
   * @param circuitId Circuit identifier
   */
  async checkCircuitHealth(circuitId: string): Promise<void> {
    const healthCheck = this.healthChecks.get(circuitId);
    
    if (!healthCheck) {
      this.logger.warn(`No health check found for circuit: ${circuitId}`);
      return;
    }
    
    await this.executeHealthCheck(circuitId, healthCheck);
  }
  
  /**
   * Execute a health check for a circuit
   * @param circuitId Circuit identifier
   * @param healthCheck Health check function
   */
  private async executeHealthCheck(
    circuitId: string, 
    healthCheck: () => Promise<boolean>
  ): Promise<void> {
    try {
      this.logger.debug(`Running health check for circuit: ${circuitId}`);
      const isHealthy = await healthCheck();
      
      if (isHealthy) {
        this.logger.log(`Health check passed for circuit: ${circuitId}, resetting circuit`);
        this.circuitBreakerService.resetCircuit(circuitId);
      } else {
        this.logger.debug(`Health check failed for circuit: ${circuitId}, circuit remains open`);
      }
    } catch (error) {
      this.logger.error(
        `Error running health check for circuit ${circuitId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  /**
   * Get all registered health checks
   * @returns Map of circuit IDs to health check functions
   */
  getRegisteredHealthChecks(): string[] {
    return Array.from(this.healthChecks.keys());
  }
}
