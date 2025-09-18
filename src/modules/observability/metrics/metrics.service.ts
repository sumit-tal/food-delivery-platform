import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import * as client from 'prom-client';

/**
 * MetricsService provides application-level metrics collection.
 * It initializes common application metrics and provides methods to record them.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  // HTTP metrics
  private httpRequestsTotal!: client.Counter<string>;
  private httpRequestDuration!: client.Histogram<string>;
  private httpRequestSize!: client.Summary<string>;
  private httpResponseSize!: client.Summary<string>;
  private httpRequestsInFlight!: client.Gauge<string>;

  // Database metrics
  private dbQueryTotal!: client.Counter<string>;
  private dbQueryDuration!: client.Histogram<string>;

  // Cache metrics
  private cacheHitTotal!: client.Counter<string>;
  private cacheMissTotal!: client.Counter<string>;
  private cacheSize!: client.Gauge<string>;

  // System metrics
  private systemMemoryUsage!: client.Gauge<string>;
  private systemCpuUsage!: client.Gauge<string>;

  public constructor(private readonly prometheusService: PrometheusService) {}

  /**
   * Initialize metrics when module starts.
   */
  public onModuleInit(): void {
    this.initHttpMetrics();
    this.initDatabaseMetrics();
    this.initCacheMetrics();
    this.initSystemMetrics();
  }

  /**
   * Initialize HTTP metrics.
   */
  private initHttpMetrics(): void {
    this.httpRequestsTotal = this.prometheusService.createCounter(
      'http_requests_total',
      'Total number of HTTP requests',
      ['method', 'path', 'status'],
    );

    this.httpRequestDuration = this.prometheusService.createHistogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      ['method', 'path', 'status'],
      [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    );

    this.httpRequestSize = this.prometheusService.createSummary(
      'http_request_size_bytes',
      'HTTP request size in bytes',
      ['method', 'path'],
    );

    this.httpResponseSize = this.prometheusService.createSummary(
      'http_response_size_bytes',
      'HTTP response size in bytes',
      ['method', 'path', 'status'],
    );

    this.httpRequestsInFlight = this.prometheusService.createGauge(
      'http_requests_in_flight',
      'Number of HTTP requests currently in flight',
      ['method', 'path'],
    );
  }

  /**
   * Initialize database metrics.
   */
  private initDatabaseMetrics(): void {
    this.dbQueryTotal = this.prometheusService.createCounter(
      'db_queries_total',
      'Total number of database queries',
      ['operation', 'entity', 'status'],
    );

    this.dbQueryDuration = this.prometheusService.createHistogram(
      'db_query_duration_seconds',
      'Database query duration in seconds',
      ['operation', 'entity'],
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
    );
  }

  /**
   * Initialize cache metrics.
   */
  private initCacheMetrics(): void {
    this.cacheHitTotal = this.prometheusService.createCounter(
      'cache_hit_total',
      'Total number of cache hits',
      ['cache'],
    );

    this.cacheMissTotal = this.prometheusService.createCounter(
      'cache_miss_total',
      'Total number of cache misses',
      ['cache'],
    );

    this.cacheSize = this.prometheusService.createGauge(
      'cache_size',
      'Current size of cache',
      ['cache'],
    );
  }

  /**
   * Initialize system metrics.
   */
  private initSystemMetrics(): void {
    this.systemMemoryUsage = this.prometheusService.createGauge(
      'system_memory_usage_bytes',
      'Memory usage in bytes',
    );

    this.systemCpuUsage = this.prometheusService.createGauge(
      'system_cpu_usage_percent',
      'CPU usage in percent',
    );

    // Update system metrics every 15 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 15000);
  }

  /**
   * Update system metrics with current values.
   */
  private updateSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    this.systemMemoryUsage.set(memoryUsage.heapUsed);

    // Note: For accurate CPU metrics in production, 
    // you would use a more sophisticated approach
    const cpuUsage = process.cpuUsage();
    const totalCpuUsage = cpuUsage.user + cpuUsage.system;
    this.systemCpuUsage.set(totalCpuUsage / 1000000); // Convert to seconds
  }

  /**
   * Record an HTTP request.
   * @param method - HTTP method
   * @param path - Request path
   * @param status - HTTP status code
   * @param duration - Request duration in seconds
   * @param requestSize - Request size in bytes
   * @param responseSize - Response size in bytes
   */
  public recordHttpRequest(
    method: string,
    path: string,
    status: number,
    duration: number,
    requestSize: number,
    responseSize: number,
  ): void {
    const labels = { method, path, status: status.toString() };
    const pathLabels = { method, path };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, duration);
    this.httpRequestSize.observe(pathLabels, requestSize);
    this.httpResponseSize.observe(labels, responseSize);
  }

  /**
   * Increment the count of in-flight HTTP requests.
   * @param method - HTTP method
   * @param path - Request path
   */
  public incrementHttpRequestsInFlight(method: string, path: string): void {
    this.httpRequestsInFlight.inc({ method, path });
  }

  /**
   * Decrement the count of in-flight HTTP requests.
   * @param method - HTTP method
   * @param path - Request path
   */
  public decrementHttpRequestsInFlight(method: string, path: string): void {
    this.httpRequestsInFlight.dec({ method, path });
  }

  /**
   * Record a database query.
   * @param operation - Query operation (e.g., SELECT, INSERT)
   * @param entity - Entity being queried
   * @param status - Query status (success or error)
   * @param duration - Query duration in seconds
   */
  public recordDbQuery(
    operation: string,
    entity: string,
    status: string,
    duration: number,
  ): void {
    this.dbQueryTotal.inc({ operation, entity, status });
    this.dbQueryDuration.observe({ operation, entity }, duration);
  }

  /**
   * Record a cache hit.
   * @param cache - Cache name
   */
  public recordCacheHit(cache: string): void {
    this.cacheHitTotal.inc({ cache });
  }

  /**
   * Record a cache miss.
   * @param cache - Cache name
   */
  public recordCacheMiss(cache: string): void {
    this.cacheMissTotal.inc({ cache });
  }

  /**
   * Update cache size.
   * @param cache - Cache name
   * @param size - Current cache size
   */
  public updateCacheSize(cache: string, size: number): void {
    this.cacheSize.set({ cache }, size);
  }
}
