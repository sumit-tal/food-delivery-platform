import { Controller, Get, Param, Post } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitBreakerHealth } from './circuit-breaker.interface';

/**
 * Controller for monitoring and managing circuit breaker health
 */
@Controller('health/circuit-breakers')
export class CircuitBreakerHealthController {
  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  /**
   * Get health information for all circuits
   * @returns Array of circuit health information
   */
  @Get()
  getCircuitHealth(): CircuitBreakerHealth[] {
    return this.circuitBreakerService.getCircuitHealth();
  }

  /**
   * Get health information for a specific circuit
   * @param id Circuit identifier
   * @returns Circuit health information
   */
  @Get(':id')
  getCircuitHealthById(@Param('id') id: string): CircuitBreakerHealth | null {
    return this.circuitBreakerService.getCircuitHealthById(id);
  }

  /**
   * Reset a circuit to closed state
   * @param id Circuit identifier
   * @returns Success message
   */
  @Post(':id/reset')
  resetCircuit(@Param('id') id: string): { success: boolean; message: string } {
    this.circuitBreakerService.resetCircuit(id);
    return { 
      success: true, 
      message: `Circuit ${id} has been reset to CLOSED state` 
    };
  }
}
