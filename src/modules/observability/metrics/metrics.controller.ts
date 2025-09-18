import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrometheusService } from './prometheus.service';

/**
 * MetricsController exposes endpoints for Prometheus metrics.
 */
@Controller('metrics')
export class MetricsController {
  public constructor(private readonly prometheusService: PrometheusService) {}

  /**
   * Exposes Prometheus metrics endpoint.
   * This endpoint is used by Prometheus server to scrape metrics.
   * @param response - Express response object
   */
  @Get()
  @Header('Content-Type', 'text/plain')
  public async getMetrics(@Res() response: Response): Promise<void> {
    const metrics = await this.prometheusService.getMetrics();
    response.send(metrics);
  }
}
