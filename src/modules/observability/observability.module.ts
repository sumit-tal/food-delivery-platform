import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsModule } from './metrics/metrics.module';
import { LoggingModule } from './logging/logging.module';
import { TracingModule } from './tracing/tracing.module';
import { AlertingModule } from './alerting/alerting.module';
import { DashboardsModule } from './dashboards/dashboards.module';

/**
 * ObservabilityModule bundles all observability and monitoring features.
 * This includes metrics collection, logging, tracing, alerting, and dashboards.
 */
@Module({
  imports: [
    ConfigModule,
    MetricsModule,
    LoggingModule,
    TracingModule,
    AlertingModule,
    DashboardsModule,
  ],
  exports: [
    MetricsModule,
    LoggingModule,
    TracingModule,
    AlertingModule,
    DashboardsModule,
  ],
})
export class ObservabilityModule {}
