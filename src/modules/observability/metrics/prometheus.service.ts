import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'prom-client';

/**
 * PrometheusService provides functionality for collecting and exposing Prometheus metrics.
 * It initializes default metrics collection and provides methods to register custom metrics.
 */
@Injectable()
export class PrometheusService implements OnModuleInit {
  private readonly registry: client.Registry;
  private readonly prefix: string;

  public constructor(private readonly configService: ConfigService) {
    this.prefix = this.configService.get<string>('METRICS_PREFIX', 'swifteats_');
    this.registry = new client.Registry();
  }

  /**
   * Initialize default metrics collection when module starts.
   */
  public onModuleInit(): void {
    // Add default metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({
      register: this.registry,
      prefix: this.prefix,
    });
  }

  /**
   * Get all collected metrics in Prometheus format.
   * @returns Promise resolving to string representation of all metrics in Prometheus format
   */
  public getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Create and register a new counter metric.
   * @param name - Metric name
   * @param help - Metric description
   * @param labelNames - Array of label names for this metric
   * @returns Counter instance
   */
  public createCounter(
    name: string,
    help: string,
    labelNames: string[] = [],
  ): client.Counter<string> {
    const counter = new client.Counter({
      name: `${this.prefix}${name}`,
      help,
      labelNames,
    });
    this.registry.registerMetric(counter);
    return counter;
  }

  /**
   * Create and register a new gauge metric.
   * @param name - Metric name
   * @param help - Metric description
   * @param labelNames - Array of label names for this metric
   * @returns Gauge instance
   */
  public createGauge(name: string, help: string, labelNames: string[] = []): client.Gauge<string> {
    const gauge = new client.Gauge({
      name: `${this.prefix}${name}`,
      help,
      labelNames,
    });
    this.registry.registerMetric(gauge);
    return gauge;
  }

  /**
   * Create and register a new histogram metric.
   * @param name - Metric name
   * @param help - Metric description
   * @param labelNames - Array of label names for this metric
   * @param buckets - Array of bucket boundaries
   * @returns Histogram instance
   */
  public createHistogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets: number[] = client.linearBuckets(0.1, 0.1, 10),
  ): client.Histogram<string> {
    const histogram = new client.Histogram({
      name: `${this.prefix}${name}`,
      help,
      labelNames,
      buckets,
    });
    this.registry.registerMetric(histogram);
    return histogram;
  }

  /**
   * Create and register a new summary metric.
   * @param name - Metric name
   * @param help - Metric description
   * @param labelNames - Array of label names for this metric
   * @param percentiles - Array of percentiles to calculate
   * @returns Summary instance
   */
  public createSummary(
    name: string,
    help: string,
    labelNames: string[] = [],
    percentiles: number[] = [0.01, 0.05, 0.5, 0.9, 0.95, 0.99],
  ): client.Summary<string> {
    const summary = new client.Summary({
      name: `${this.prefix}${name}`,
      help,
      labelNames,
      percentiles,
    });
    this.registry.registerMetric(summary);
    return summary;
  }

  /**
   * Get the Prometheus registry.
   * @returns Prometheus registry instance
   */
  public getRegistry(): client.Registry {
    return this.registry;
  }
}
