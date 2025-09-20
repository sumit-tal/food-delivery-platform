import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Service for managing database connections and connection pooling
 */
@Injectable()
export class DatabaseConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseConnectionService.name);
  private dataSource!: DataSource;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize the database connection pool when the module is initialized
   */
  async onModuleInit(): Promise<void> {
    await this.initializeDataSource();
  }

  /**
   * Close the database connection pool when the module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.logger.log('Database connection pool closed');
    }
  }

  /**
   * Initialize the data source with connection pooling
   */
  private async initializeDataSource(): Promise<void> {
    const options: DataSourceOptions = {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'password'),
      database: this.configService.get<string>('DB_DATABASE', 'swifteats'),
      entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
      synchronize: this.configService.get<boolean>('DB_SYNCHRONIZE', false),
      // Connection pool configuration
      extra: {
        // Max number of clients in the pool
        max: this.configService.get<number>('DB_POOL_SIZE', 50),
        // Max time (ms) that a client can stay idle before being closed
        idleTimeoutMillis: this.configService.get<number>('DB_IDLE_TIMEOUT', 30000),
        // Max time (ms) to wait for a client to become available
        connectionTimeoutMillis: this.configService.get<number>('DB_CONNECTION_TIMEOUT', 5000),
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
   * Get the current pool size
   * @returns The current pool size
   */
  getPoolSize(): number {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      return 0;
    }

    // TypeORM doesn't expose pool stats directly, but we can get the configured size
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
