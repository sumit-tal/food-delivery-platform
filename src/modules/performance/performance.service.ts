import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryPerformanceService } from '../../common/services/query-performance.service';
import { ReadReplicaService } from '../../common/services/read-replica.service';
import { ConnectionPoolService } from '../../common/services/connection-pool.service';
import { IndexOptimizationService } from '../../common/services/index-optimization.service';
import { WebSocketOptimizationService } from '../../common/services/websocket-optimization.service';
import { JobOptimizationService } from '../../common/services/job-optimization.service';

/**
 * Service for managing and monitoring overall system performance
 */
@Injectable()
export class PerformanceService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceService.name);
  private readonly enablePerformanceMonitoring: boolean;
  private readonly performanceMonitoringIntervalMs: number;
  private performanceMonitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly queryPerformanceService: QueryPerformanceService,
    private readonly readReplicaService: ReadReplicaService,
    private readonly connectionPoolService: ConnectionPoolService,
    private readonly indexOptimizationService: IndexOptimizationService,
    private readonly webSocketOptimizationService: WebSocketOptimizationService,
    private readonly jobOptimizationService: JobOptimizationService,
  ) {
    this.enablePerformanceMonitoring = this.configService.get<boolean>('ENABLE_PERFORMANCE_MONITORING', true);
    this.performanceMonitoringIntervalMs = this.configService.get<number>('PERFORMANCE_MONITORING_INTERVAL_MS', 300000); // Default: 5 minutes
  }

  /**
   * Initialize performance monitoring when the module is initialized
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Performance optimization module initialized');
    
    if (this.enablePerformanceMonitoring) {
      await Promise.resolve(this.startPerformanceMonitoring());
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (this.performanceMonitoringInterval) {
      return;
    }
    
    this.performanceMonitoringInterval = setInterval(() => {
      void this.collectPerformanceMetrics().catch(error => {
        this.logger.error(`Error collecting performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    }, this.performanceMonitoringIntervalMs);
    
    this.logger.log(`Performance monitoring started (interval: ${this.performanceMonitoringIntervalMs / 1000 / 60} minutes)`);
  }

  /**
   * Stop performance monitoring
   */
  stopPerformanceMonitoring(): void {
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
      this.performanceMonitoringInterval = null;
      this.logger.log('Performance monitoring stopped');
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(): Promise<void> {
    this.logger.log('Collecting performance metrics');
    
    try {
      // Database connection pool metrics
      const activeConnections = await this.connectionPoolService.getActiveConnections();
      const poolSize = this.connectionPoolService.getPoolSize();
      
      // Read replica metrics
      const readReplicaCount = this.readReplicaService.getReadReplicaCount();
      
      // Log metrics
      this.logger.log(`Database metrics: Active connections: ${activeConnections}/${poolSize}, Read replicas: ${readReplicaCount}`);
      
      // Memory usage metrics
      const memoryUsage = process.memoryUsage();
      this.logger.log(`Memory usage: RSS: ${this.formatBytes(memoryUsage.rss)}, Heap: ${this.formatBytes(memoryUsage.heapUsed)}/${this.formatBytes(memoryUsage.heapTotal)}`);
      
      // CPU usage metrics
      const cpuUsage = process.cpuUsage();
      this.logger.log(`CPU usage: User: ${cpuUsage.user / 1000}ms, System: ${cpuUsage.system / 1000}ms`);
    } catch (error) {
      this.logger.error(`Error collecting performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format bytes to a human-readable string
   * @param bytes The number of bytes
   * @returns A human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get system health metrics
   * @returns System health metrics
   */
  async getSystemHealthMetrics(): Promise<Record<string, unknown>> {
    try {
      const [databaseMetrics, memoryMetrics, cpuMetrics] = await Promise.all([
        this.getDatabaseMetrics(),
        this.getMemoryMetrics(),
        this.getCpuMetrics(),
      ]);
      
      // Format the metrics
      const metrics: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        database: databaseMetrics,
        memory: memoryMetrics,
        cpu: cpuMetrics,
        uptime: process.uptime(),
      };
      
      return metrics;
    } catch (error) {
      this.logger.error(`Error getting system health metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Get database metrics
   * @returns Database metrics
   */
  private async getDatabaseMetrics(): Promise<Record<string, unknown>> {
    // Database connection pool metrics
    const activeConnections = await this.connectionPoolService.getActiveConnections();
    const poolSize = this.connectionPoolService.getPoolSize();
    
    // Read replica metrics
    const readReplicaCount = this.readReplicaService.getReadReplicaCount();
    
    return {
      activeConnections,
      poolSize,
      readReplicaCount,
      connectionUtilization: poolSize > 0 ? (activeConnections / poolSize) * 100 : 0,
    };
  }
  
  /**
   * Get memory metrics
   * @returns Memory metrics
   */
  private getMemoryMetrics(): Record<string, unknown> {
    const memoryUsage = process.memoryUsage();
    
    return {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      heapUtilization: memoryUsage.heapTotal > 0 ? (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100 : 0,
    };
  }
  
  /**
   * Get CPU metrics
   * @returns CPU metrics
   */
  private getCpuMetrics(): Record<string, unknown> {
    const cpuUsage = process.cpuUsage();
    
    return {
      user: cpuUsage.user,
      system: cpuUsage.system,
    };
  }
}
