import { Module, Global } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectionPoolService } from '../../common/services/connection-pool.service';
import { ReadReplicaService } from '../../common/services/read-replica.service';
import { QueryPerformanceService } from '../../common/services/query-performance.service';
import { IndexOptimizationService } from '../../common/services/index-optimization.service';
import { PERFORMANCE_CONSTANTS } from '../../common/constants/performance.constants';

/**
 * Create TypeORM options with optimized settings
 * @param configService The config service
 * @returns TypeORM options
 */
function createTypeOrmOptions(configService: ConfigService): TypeOrmModuleOptions {
  const dbHost = configService.get<string>('DB_HOST', 'localhost');
  const dbPort = configService.get<number>('DB_PORT', 5432);
  const dbUsername = configService.get<string>('DB_USERNAME', 'postgres');
  const dbPassword = configService.get<string>('DB_PASSWORD', 'postgres');
  const dbName = configService.get<string>('DB_DATABASE', 'swifteats');
  const dbSync = configService.get<boolean>('DB_SYNCHRONIZE', false);
  const dbLogging = configService.get<boolean>('DB_LOGGING', false);
  
  // Get optimized pool settings from constants or environment
  const poolSize = configService.get<number>(
    'DB_POOL_SIZE', 
    PERFORMANCE_CONSTANTS.DB_POOL_SIZE
  );
  const poolMinSize = configService.get<number>(
    'DB_POOL_MIN_SIZE', 
    PERFORMANCE_CONSTANTS.DB_POOL_MIN_SIZE
  );
  const idleTimeout = configService.get<number>(
    'DB_IDLE_TIMEOUT', 
    PERFORMANCE_CONSTANTS.DB_IDLE_TIMEOUT
  );
  const connectionTimeout = configService.get<number>(
    'DB_CONNECTION_TIMEOUT', 
    PERFORMANCE_CONSTANTS.DB_CONNECTION_TIMEOUT
  );
  const statementTimeout = configService.get<number>(
    'DB_STATEMENT_TIMEOUT', 
    PERFORMANCE_CONSTANTS.DB_STATEMENT_TIMEOUT
  );
  const connectTimeout = configService.get<number>(
    'DB_CONNECT_TIMEOUT', 
    PERFORMANCE_CONSTANTS.DB_CONNECT_TIMEOUT
  );
  
  return {
    type: 'postgres',
    host: dbHost,
    port: dbPort,
    username: dbUsername,
    password: dbPassword,
    database: dbName,
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: dbSync,
    logging: dbLogging,
    logger: 'advanced-console',
    // Enhanced connection pool configuration
    extra: {
      // Max number of clients in the pool
      max: poolSize,
      // Min number of clients in the pool
      min: poolMinSize,
      // Max time (ms) that a client can stay idle before being closed
      idleTimeoutMillis: idleTimeout,
      // Max time (ms) to wait for a client to become available
      connectionTimeoutMillis: connectionTimeout,
      // Max time (ms) to wait for a query to complete
      statement_timeout: statementTimeout,
      // Max time (ms) to wait for a connection to be established
      connect_timeout: connectTimeout,
      // Enable keepalive
      keepalive: true,
    },
    // Enable query metrics collection
    maxQueryExecutionTime: PERFORMANCE_CONSTANTS.DB_SLOW_QUERY_THRESHOLD_MS,
  };
}

/**
 * Global module for database configuration and optimization
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        return createTypeOrmOptions(configService);
      },
    }),
  ],
  providers: [
    ConnectionPoolService,
    ReadReplicaService,
    QueryPerformanceService,
    IndexOptimizationService,
  ],
  exports: [
    TypeOrmModule,
    ConnectionPoolService,
    ReadReplicaService,
    QueryPerformanceService,
    IndexOptimizationService,
  ],
})
export class DatabaseModule {}
