import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: unknown) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

/**
 * RateLimitingService provides in-memory rate limiting functionality
 * with configurable windows and limits per endpoint/user.
 *
 * Note: This is a simplified version that uses in-memory storage.
 * For production with multiple instances, consider using Redis.
 */
@Injectable()
export class RateLimitingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitingService.name);
  private readonly rateLimitStore = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval?: NodeJS.Timeout;

  public constructor(private readonly configService: ConfigService) {}

  public onModuleInit(): void {
    // Start cleanup interval every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredKeys();
      },
      5 * 60 * 1000,
    );

    this.logger.log('Rate limiting service initialized with in-memory storage');
  }

  public onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Check if a request is within rate limits
   */
  public checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const window = Math.floor(now / config.windowMs);
    const rateLimitKey = `${key}:${window}`;

    try {
      return this.processRateLimitCheck(rateLimitKey, config, now, window);
    } catch (error) {
      this.logger.error('Rate limit check failed:', error);
      return this.getFallbackResult(config, now);
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  public getRateLimitStatus(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const window = Math.floor(now / config.windowMs);
    const rateLimitKey = `${key}:${window}`;

    try {
      return this.processRateLimitStatus(rateLimitKey, config, now, window);
    } catch (error) {
      this.logger.error('Rate limit status check failed:', error);
      return this.getFallbackResult(config, now);
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  public resetRateLimit(key: string): void {
    try {
      const keysToDelete: string[] = [];

      for (const [storeKey] of this.rateLimitStore) {
        if (storeKey.startsWith(`${key}:`)) {
          keysToDelete.push(storeKey);
        }
      }

      for (const keyToDelete of keysToDelete) {
        this.rateLimitStore.delete(keyToDelete);
      }

      this.logger.debug(`Reset rate limit for key: ${key}`);
    } catch (error) {
      this.logger.error('Rate limit reset failed:', error);
    }
  }

  /**
   * Clean up expired rate limit keys
   */
  public cleanupExpiredKeys(): void {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, value] of this.rateLimitStore) {
        if (value.resetTime < now) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.rateLimitStore.delete(key);
      }

      if (keysToDelete.length > 0) {
        this.logger.debug(`Cleaned up ${keysToDelete.length} expired rate limit keys`);
      }
    } catch (error) {
      this.logger.error('Rate limit cleanup failed:', error);
    }
  }

  /**
   * Get current store statistics
   */
  public getStats(): { totalKeys: number; memoryUsage: string } {
    const totalKeys = this.rateLimitStore.size;
    const memoryUsage = `${Math.round((totalKeys * 50) / 1024)} KB`; // Rough estimate

    return { totalKeys, memoryUsage };
  }

  /**
   * Process the rate limit status check logic (without incrementing)
   */
  private processRateLimitStatus(
    rateLimitKey: string,
    config: RateLimitConfig,
    now: number,
    window: number,
  ): RateLimitResult {
    const existing = this.rateLimitStore.get(rateLimitKey);
    const resetTime = (window + 1) * config.windowMs;

    if (!existing || existing.resetTime < now) {
      return this.createEmptyWindowResult(config, resetTime);
    }

    return this.createExistingWindowResult(existing, config, resetTime);
  }

  /**
   * Process the rate limit check logic
   */
  private processRateLimitCheck(
    rateLimitKey: string,
    config: RateLimitConfig,
    now: number,
    window: number,
  ): RateLimitResult {
    const existing = this.rateLimitStore.get(rateLimitKey);
    const resetTime = (window + 1) * config.windowMs;

    if (!existing || existing.resetTime < now) {
      return this.handleFirstRequest(rateLimitKey, config, resetTime);
    }

    return this.handleExistingRequest(rateLimitKey, existing, config, resetTime);
  }

  /**
   * Handle first request in window
   */
  private handleFirstRequest(
    rateLimitKey: string,
    config: RateLimitConfig,
    resetTime: number,
  ): RateLimitResult {
    this.rateLimitStore.set(rateLimitKey, { count: 1, resetTime });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
      totalHits: 1,
    };
  }

  /**
   * Create result for empty window (status check)
   */
  private createEmptyWindowResult(config: RateLimitConfig, resetTime: number): RateLimitResult {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime,
      totalHits: 0,
    };
  }

  /**
   * Create result for existing window (status check)
   */
  private createExistingWindowResult(
    existing: { count: number; resetTime: number },
    config: RateLimitConfig,
    resetTime: number,
  ): RateLimitResult {
    const remaining = Math.max(0, config.maxRequests - existing.count);
    const allowed = existing.count <= config.maxRequests;

    return {
      allowed,
      remaining,
      resetTime,
      totalHits: existing.count,
    };
  }

  /**
   * Handle existing request in window
   */
  private handleExistingRequest(
    rateLimitKey: string,
    existing: { count: number; resetTime: number },
    config: RateLimitConfig,
    resetTime: number,
  ): RateLimitResult {
    existing.count += 1;
    this.rateLimitStore.set(rateLimitKey, existing);

    const remaining = Math.max(0, config.maxRequests - existing.count);
    const allowed = existing.count <= config.maxRequests;

    return {
      allowed,
      remaining,
      resetTime,
      totalHits: existing.count,
    };
  }

  /**
   * Fallback result when rate limiting fails
   */
  private getFallbackResult(config: RateLimitConfig, now: number): RateLimitResult {
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      totalHits: 0,
    };
  }
}
