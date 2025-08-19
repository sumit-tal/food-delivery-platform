import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * HealthController exposes liveness and readiness probes.
 */
@Controller('health')
export class HealthController {
  public constructor(private readonly healthService: HealthService) {}

  @Get()
  /**
   * Returns application liveness information.
   * @returns Object containing status, uptime in seconds, and ISO timestamp.
   */
  public getLiveness(): { status: string; uptime: number; timestamp: string } {
    return this.healthService.getLiveness();
  }
}
