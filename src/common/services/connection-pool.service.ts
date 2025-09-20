import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Service for managing optimized database connection pooling
 */
@Injectable()
export class ConnectionPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private dataSource!: DataSource;
  private poolMetricsInterval: NodeJS.Timeout | null = null;
  private readonly poolMetricsIntervalMs: number;

  constructor(private readonly configService: ConfigService) {
    this.poolMetricsIntervalMs = this.configService.get<number>(
      'DB_POOL_METRICS_INTERVAL_MS',
      60000,
    );
  }

  /**
   * Initialize the connection pool when the module is initialized
   */
  async onModuleInit(): Promise<void> {
    await this.initializeDataSource();
    this.startPoolMetricsCollection();
  }

  /**
   * Close the connection pool when the module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    this.stopPoolMetricsCollection();

    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.logger.log('Database connection pool closed');
    }
  }

  /**
   * Initialize the data source with optimized connection pooling
   */
  private async initializeDataSource(): Promise<void> {
    const options: DataSourceOptions = {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'password'),
      database: this.configService.get<string>('DB_DATABASE', 'swifteats'),
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      synchronize: this.configService.get<boolean>('DB_SYNCHRONIZE', false),
      // Enhanced connection pool configuration
      extra: {
        // Max number of clients in the pool
        max: this.configService.get<number>('DB_POOL_SIZE', 50),
        // Min number of clients in the pool
        min: this.configService.get<number>('DB_POOL_MIN_SIZE', 5),
        // Max time (ms) that a client can stay idle before being closed
        idleTimeoutMillis: this.configService.get<number>('DB_IDLE_TIMEOUT', 30000),
        // Max time (ms) to wait for a client to become available
        connectionTimeoutMillis: this.configService.get<number>('DB_CONNECTION_TIMEOUT', 5000),
        // Max time (ms) to wait for a query to complete
        statement_timeout: this.configService.get<number>('DB_STATEMENT_TIMEOUT', 30000),
        // Max time (ms) to wait for a connection to be established
        connect_timeout: this.configService.get<number>('DB_CONNECT_TIMEOUT', 10000),
        // Time (ms) to wait before retrying a failed connection
        retry_delay: this.configService.get<number>('DB_RETRY_DELAY', 100),
        // Max number of connection retries
        max_retries: this.configService.get<number>('DB_MAX_RETRIES', 5),
        // Enable keepalive
        keepalive: true,
        // Keepalive idle time (ms)
        keepaliveInitialDelay: this.configService.get<number>('DB_KEEPALIVE_INITIAL_DELAY', 60000),
      },
      // Logging configuration
      logging: this.configService.get<boolean>('DB_LOGGING', false),
      logger: 'advanced-console',
    };

    this.dataSource = new DataSource(options);
    await this.dataSource.initialize();

    const poolSize = this.configService.get<number>('DB_POOL_SIZE', 50);
    this.logger.log(`Database connection pool initialized with size: ${poolSize}`);
  }

  /**
   * Get the data source
   * @returns The data source
   */
  getDataSource(): DataSource {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('Database connection pool not initialized');
    }
    return this.dataSource;
  }

  /**
   * Start collecting pool metrics
   */
  private startPoolMetricsCollection(): void {
    if (this.poolMetricsInterval) {
      return;
    }

    this.poolMetricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectPoolMetrics();
        this.logger.debug(`Connection pool metrics: ${JSON.stringify(metrics)}`);
      } catch (error) {
        this.logger.error(
          `Error collecting pool metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }, this.poolMetricsIntervalMs);
  }

  /**
   * Stop collecting pool metrics
   */
  private stopPoolMetricsCollection(): void {
    if (this.poolMetricsInterval) {
      clearInterval(this.poolMetricsInterval);
      this.poolMetricsInterval = null;
    }
  }

  /**
   * Collect pool metrics
   * @returns The pool metrics
   */
  private async collectPoolMetrics(): Promise<Record<string, number>> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return {
        total: 0,
        idle: 0,
        active: 0,
      };
    }

    try {
      // Execute a query to get pool statistics
      // Note: This is PostgreSQL-specific
      const result = await this.dataSource.query(
        `
        SELECT
          count(*) as total_connections,
          sum(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) as idle_connections,
          sum(CASE WHEN state = 'active' THEN 1 ELSE 0 END) as active_connections
        FROM pg_stat_activity
        WHERE datname = $1
      `,
        [this.configService.get<string>('DB_DATABASE', 'swifteats')],
      );

      return {
        total: parseInt(result[0].total_connections, 10),
        idle: parseInt(result[0].idle_connections, 10),
        active: parseInt(result[0].active_connections, 10),
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Error getting pool metrics', error.stack);
      } else {
        this.logger.error('Error getting pool metrics');
      }

      return {
        total: 0,
        idle: 0,
        active: 0,
      };
    }
  }

  /**
   * Get the current pool size
   * @returns The current pool size
   */
  getPoolSize(): number {
    return this.configService.get<number>('DB_POOL_SIZE', 50);
  }

  /**
   * Get the current number of active connections
   * @returns The current number of active connections
   */
  async getActiveConnections(): Promise<number> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return 0;
    }

    try {
      // Execute a query to get the number of active connections
      const result = await this.dataSource.query(
        "SELECT count(*) as count FROM pg_stat_activity WHERE datname = $1 AND state = 'active'",
        [this.configService.get<string>('DB_DATABASE', 'swifteats')],
      );

      return parseInt(result[0].count, 10);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Error getting active connections', error.stack);
      } else {
        this.logger.error('Error getting active connections');
      }
      return 0;
    }
  }
}
