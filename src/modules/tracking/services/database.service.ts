import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getBoolean } from '../../../common/utils/config.utils';

/**
 * Service for database operations related to driver tracking
 * Handles PostgreSQL with PostGIS for geospatial data
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool; // Using definite assignment assertion

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize the database connection pool
   */
  async onModuleInit(): Promise<void> {
    try {
      // Initialize the database connection pool
      this.initializePool();

      // Test the connection and optionally verify PostGIS is available
      await this.testConnection();
    } catch (error) {
      this.logger.error(
        `Failed to initialize database connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Initialize the database connection pool
   */
  private initializePool(): void {
    this.pool = new Pool({
      host: this.configService.get<string>('PG_HOST', 'localhost'),
      port: this.configService.get<number>('PG_PORT', 5432),
      user: this.configService.get<string>('PG_USER', 'postgres'),
      password: this.configService.get<string>('PG_PASSWORD', 'password'),
      database: this.configService.get<string>('PG_DATABASE', 'swifteats'),
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
      connectionTimeoutMillis: 2000, // How long to wait for a connection
    });
  }

  /**
   * Test the database connection and verify PostGIS is available
   */
  private async testConnection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const postgisRequired = getBoolean(this.configService, 'POSTGIS_REQUIRED', true);
      if (postgisRequired) {
        // Check if PostGIS extension is available
        interface PostGISVersion {
          postgis_version: string;
        }
        const result = await client.query<PostGISVersion>('SELECT PostGIS_Version()');
        this.logger.log(
          `Connected to PostgreSQL with PostGIS version: ${result.rows[0].postgis_version}`,
        );
      } else {
        // Simple connectivity check
        const result = await client.query<{ now: string }>('SELECT NOW() as now');
        this.logger.log(`Connected to PostgreSQL. Server time: ${result.rows[0].now}`);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Clean up database connections when the module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Database connection pool closed');
    }
  }

  /**
   * Get a client from the connection pool
   */
  async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      this.logger.error(
        `Error getting database client: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Execute a query with parameters and return typed results
   */
  async query<T extends QueryResultRow = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const client = await this.getClient();
    try {
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Execute a batch of queries in a transaction
   */
  async executeTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Transaction error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    } finally {
      client.release();
    }
  }
}
