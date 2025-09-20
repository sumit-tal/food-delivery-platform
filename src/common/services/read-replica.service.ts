import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

/**
 * Service for managing database read replicas for high-volume read operations
 */
@Injectable()
export class ReadReplicaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadReplicaService.name);
  private readReplicas: DataSource[] = [];
  private currentReplicaIndex = 0;
  private readonly maxRetries = 3;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize the read replicas when the module is initialized
   */
  async onModuleInit(): Promise<void> {
    await this.initializeReadReplicas();
  }

  /**
   * Close the read replica connections when the module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    for (const replica of this.readReplicas) {
      if (replica.isInitialized) {
        await replica.destroy();
      }
    }
    this.logger.log('All read replica connections closed');
  }

  /**
   * Initialize the read replica connections
   */
  private async initializeReadReplicas(): Promise<void> {
    const replicaHosts = this.configService.get<string>('DB_READ_REPLICA_HOSTS', '');

    if (!replicaHosts) {
      this.logger.log('No read replicas configured, skipping initialization');
      return;
    }

    const hosts = replicaHosts.split(',');
    const baseOptions: Omit<PostgresConnectionOptions, 'host'> = {
      type: 'postgres',
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'password'),
      database: this.configService.get<string>('DB_DATABASE', 'swifteats'),
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: this.configService.get<boolean>('DB_LOGGING', false),
      extra: {
        max: this.configService.get<number>('DB_REPLICA_POOL_SIZE', 20),
        idleTimeoutMillis: this.configService.get<number>('DB_IDLE_TIMEOUT', 30000),
        connectionTimeoutMillis: this.configService.get<number>('DB_CONNECTION_TIMEOUT', 5000),
      },
    };

    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i].trim();
      if (!host) continue;

      try {
        const options: PostgresConnectionOptions = {
          ...baseOptions,
          host,
          name: `read-replica-${i}`,
        };

        const replica = new DataSource(options);
        await replica.initialize();
        this.readReplicas.push(replica);
        this.logger.log(`Read replica connected: ${host}`);
      } catch (error) {
        this.logger.error(
          `Failed to connect to read replica ${host}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (this.readReplicas.length === 0) {
      this.logger.warn('No read replicas were successfully connected');
    } else {
      this.logger.log(`${this.readReplicas.length} read replicas initialized`);
    }
  }

  /**
   * Get a read replica connection using round-robin selection
   * @returns A read replica data source
   */
  getReadReplica(): DataSource {
    if (this.readReplicas.length === 0) {
      throw new Error('No read replicas available');
    }

    // Simple round-robin selection
    const index = this.currentReplicaIndex;
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.readReplicas.length;

    return this.readReplicas[index];
  }

  /**
   * Execute a read query on a replica with failover to other replicas if needed
   * @param queryFn Function that executes the query with a DataSource
   * @returns The query result
   */
  async executeReadQuery<T>(queryFn: (dataSource: DataSource) => Promise<T>): Promise<T> {
    if (this.readReplicas.length === 0) {
      throw new Error('No read replicas available');
    }

    let lastError: Error | null = null;
    let retriesLeft = this.maxRetries;

    while (retriesLeft > 0) {
      const replica = this.getReadReplica();

      try {
        return await queryFn(replica);
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error('Unknown error during query execution');
        this.logger.warn(`Read replica query failed, retrying: ${lastError.message}`);
        retriesLeft--;
      }
    }

    throw lastError || new Error('Failed to execute read query after retries');
  }

  /**
   * Check if read replicas are available
   * @returns True if read replicas are available
   */
  hasReadReplicas(): boolean {
    return this.readReplicas.length > 0;
  }

  /**
   * Get the number of available read replicas
   * @returns The number of available read replicas
   */
  getReadReplicaCount(): number {
    return this.readReplicas.length;
  }
}
