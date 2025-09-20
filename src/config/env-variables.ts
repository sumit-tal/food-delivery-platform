import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * EnvVariables defines and validates the environment configuration.
 */
export class EnvVariables {
  @IsEnum(['development', 'test', 'production'] as const)
  public NODE_ENV!: 'development' | 'test' | 'production';

  @IsInt()
  @Min(1)
  @Max(65535)
  public PORT!: number;

  @IsOptional()
  public readonly UNUSED_PLACEHOLDER?: string;

  /**
   * JWT secret used to sign access tokens.
   */
  @IsString()
  public JWT_SECRET!: string;

  /**
   * JWT expiration (e.g., '15m', '1h').
   * Default aligns with common practice for short-lived access tokens.
   */
  @IsString()
  public JWT_EXPIRES_IN: string = '15m';

  /**
   * Logical issuer for tokens.
   */
  @IsString()
  public JWT_ISSUER: string = 'swifteats';

  /**
   * Logical audience for tokens.
   */
  @IsString()
  public JWT_AUDIENCE: string = 'swifteats-api';

  /**
   * Base64-encoded 32-byte key for AES-256-GCM encryption of sensitive data.
   */
  @IsString()
  public ENCRYPTION_KEY!: string;

  /**
   * Optional OAuth2 provider credentials (placeholders for future providers).
   */
  @IsOptional()
  @IsString()
  public OAUTH_GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  public OAUTH_GOOGLE_CLIENT_SECRET?: string;

  /**
   * Cache provider for catalog data. Default is 'memory'.
   */
  @IsEnum(['memory', 'redis'] as const)
  public CACHE_PROVIDER: 'memory' | 'redis' = 'memory';

  /**
   * Redis connection URL (e.g., redis://localhost:6379). Required if CACHE_PROVIDER=redis.
   */
  @IsOptional()
  @IsString()
  public REDIS_URL?: string;

  /**
   * Optional Redis key prefix for namespacing cache keys.
   */
  @IsOptional()
  @IsString()
  public REDIS_KEY_PREFIX?: string;

  /**
   * Optional CDN base URL to rewrite static asset links (e.g., images) in menu responses.
   */
  @IsOptional()
  @IsString()
  public CDN_BASE_URL?: string;

  /**
   * WebSocket port for real-time communication
   */
  @IsInt()
  @Min(1)
  @Max(65535)
  public WS_PORT: number = 3001;

  /**
   * PostgreSQL connection details for geospatial data
   */
  @IsString()
  public PG_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  public PG_PORT: number = 5432;

  @IsString()
  public PG_USER: string = 'postgres';

  @IsString()
  public PG_PASSWORD: string = 'password';

  @IsString()
  public PG_DATABASE: string = 'swifteats';

  /**
   * Message queue configuration for location updates
   */
  @IsInt()
  @Min(1)
  public LOCATION_QUEUE_CONCURRENCY: number = 5;

  @IsInt()
  @Min(1)
  public LOCATION_BATCH_SIZE: number = 100;

  @IsInt()
  @Min(100)
  public LOCATION_BATCH_INTERVAL_MS: number = 1000;

  /**
   * Driver tracking settings
   */
  @IsInt()
  @Min(1)
  public DRIVER_LOCATION_TTL_SECONDS: number = 300;

  @IsInt()
  @Min(1)
  public MAX_CONCURRENT_CONNECTIONS: number = 10000;

  @IsInt()
  @Min(500)
  public CLIENT_POLLING_INTERVAL_MS: number = 1000;

  /**
   * Observability - Logging to Elasticsearch
   */
  @IsBoolean()
  public ELASTICSEARCH_ENABLED: boolean = false;

  @IsString()
  public ELASTICSEARCH_NODE: string = 'http://localhost:9200';

  @IsOptional()
  @IsString()
  public ELASTICSEARCH_USERNAME?: string;

  @IsOptional()
  @IsString()
  public ELASTICSEARCH_PASSWORD?: string;

  @IsString()
  public ELASTICSEARCH_INDEX_PREFIX: string = 'swifteats-logs';

  @IsInt()
  @Min(1)
  public ELASTICSEARCH_BULK_SIZE: number = 100;

  @IsInt()
  @Min(100)
  public ELASTICSEARCH_FLUSH_INTERVAL: number = 5000;

  /**
   * Observability - Alerting via AlertManager
   */
  @IsBoolean()
  public ALERTING_ENABLED: boolean = false;

  @IsString()
  public ALERT_MANAGER_URL: string = 'http://localhost:9093/api/v2/alerts';

  /**
   * Database - PostGIS requirement flag
   * If false, the service will not fail startup when PostGIS is missing.
   */
  @IsBoolean()
  public POSTGIS_REQUIRED: boolean = true;
}
