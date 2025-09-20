import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

/**
 * TypeORM DataSource configuration for migrations and CLI operations
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  username: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'password',
  database: process.env.PG_DATABASE || 'swifteats',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: true, // Never set to true in production
  logging: process.env.NODE_ENV === 'development',
  migrationsTableName: 'migrations',
  migrationsRun: false, // Don't run migrations automatically on application start
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  // Enhanced connection pool configuration
  extra: {
    // Max number of clients in the pool
    max: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    // Min number of clients in the pool
    min: parseInt(process.env.DB_POOL_MIN_SIZE || '2', 10),
    // Max time (ms) that a client can stay idle before being closed
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    // Max time (ms) to wait for a client to become available
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
    // Max time (ms) to wait for a query to complete
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
    // Max time (ms) to wait for a connection to be established
    connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
    // Enable keepalive
    keepalive: true,
  },
};

/**
 * TypeORM DataSource instance for migrations and CLI operations
 */
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
