import { Injectable } from '@nestjs/common';

/**
 * HealthService provides health status information.
 */
@Injectable()
export class HealthService {
  /**
   * Returns current liveness information for the application.
   * @returns Object containing status, uptime in seconds, and ISO timestamp.
   */
  public getLiveness(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    } as const;
  }
}
