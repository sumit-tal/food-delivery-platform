import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentResult } from '../interfaces/payment-gateway.interface';

/**
 * Service for caching payment responses to handle duplicate requests
 */
@Injectable()
export class PaymentCacheService {
  private readonly logger = new Logger(PaymentCacheService.name);
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly ttlMs: number;

  constructor(private readonly configService: ConfigService) {
    // Get TTL from config or use default (30 minutes)
    this.ttlMs = this.configService.get<number>('PAYMENT_CACHE_TTL_MS', 30 * 60 * 1000);
  }

  /**
   * Get a cached payment result by idempotency key
   * @param idempotencyKey The idempotency key
   * @returns The cached payment result or null if not found
   */
  get(idempotencyKey: string): PaymentResult | null {
    const entry = this.cache.get(idempotencyKey);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.logger.debug(`Cache entry for ${idempotencyKey} has expired`);
      this.cache.delete(idempotencyKey);
      return null;
    }
    
    this.logger.debug(`Cache hit for idempotency key ${idempotencyKey}`);
    return entry.result;
  }

  /**
   * Set a payment result in the cache
   * @param idempotencyKey The idempotency key
   * @param result The payment result to cache
   * @param customTtlMs Optional custom TTL in milliseconds
   */
  set(idempotencyKey: string, result: PaymentResult, customTtlMs?: number): void {
    const ttl = customTtlMs || this.ttlMs;
    const expiresAt = Date.now() + ttl;
    
    this.cache.set(idempotencyKey, {
      result,
      expiresAt
    });
    
    this.logger.debug(`Cached payment result for idempotency key ${idempotencyKey}, expires in ${ttl}ms`);
  }

  /**
   * Remove a cached payment result
   * @param idempotencyKey The idempotency key
   */
  remove(idempotencyKey: string): void {
    this.cache.delete(idempotencyKey);
    this.logger.debug(`Removed cache entry for idempotency key ${idempotencyKey}`);
  }

  /**
   * Clear expired entries from the cache
   * @returns Number of entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.logger.debug(`Removed ${removedCount} expired cache entries`);
    }
    
    return removedCount;
  }
}

/**
 * Cache entry interface
 */
interface CacheEntry {
  /** The cached payment result */
  result: PaymentResult;
  
  /** Timestamp when this entry expires */
  expiresAt: number;
}
