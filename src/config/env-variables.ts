import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
}
