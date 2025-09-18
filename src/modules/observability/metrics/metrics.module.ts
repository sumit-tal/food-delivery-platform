import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { PrometheusService } from './prometheus.service';
import { CustomMetricsService } from './custom-metrics.service';
import { LagMonitoringService } from './lag-monitoring.service';

/**
 * MetricsModule provides functionality for collecting and exposing metrics
 * using Prometheus. It includes both system metrics and custom business metrics.
 */
@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [MetricsService, PrometheusService, CustomMetricsService, LagMonitoringService],
  exports: [MetricsService, PrometheusService, CustomMetricsService, LagMonitoringService],
})
export class MetricsModule {}
