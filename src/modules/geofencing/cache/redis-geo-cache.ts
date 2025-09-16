import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { GeoCache } from './geo-cache.interface';

/**
 * Redis implementation of the GeoCache interface.
 */
@Injectable()
export class RedisGeoCache implements GeoCache {
  private readonly redisClient: Redis;
  private readonly keyPrefix: string;

  constructor(
    @Inject('REDIS_CLIENT') redisClient: Redis,
    private readonly configService: ConfigService
  ) {
    this.redisClient = redisClient;
    this.keyPrefix = this.configService.get<string>('REDIS_KEY_PREFIX', 'geo');
  }

  /**
   * Gets a value from the cache.
   * 
   * @param key - Cache key
   * @returns The cached value or undefined if not found
   */
  public async get<T>(key: string): Promise<T | undefined> {
    const prefixedKey: string = this.getPrefixedKey(key);
    const value: string | null = await this.redisClient.get(prefixedKey);

    if (!value) {
      return undefined;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Sets a value in the cache.
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds (optional)
   */
  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const prefixedKey: string = this.getPrefixedKey(key);
    const serializedValue: string = JSON.stringify(value);

    if (ttlSeconds) {
      await this.redisClient.setex(prefixedKey, ttlSeconds, serializedValue);
    } else {
      await this.redisClient.set(prefixedKey, serializedValue);
    }
  }

  /**
   * Deletes a value from the cache.
   * 
   * @param key - Cache key
   * @returns True if the value was deleted, false if it wasn't found
   */
  public async delete(key: string): Promise<boolean> {
    const prefixedKey: string = this.getPrefixedKey(key);
    const result: number = await this.redisClient.del(prefixedKey);
    return result > 0;
  }

  /**
   * Clears all keys with the configured prefix.
   */
  public async clear(): Promise<void> {
    const pattern: string = `${this.keyPrefix}:*`;
    const keys: string[] = await this.redisClient.keys(pattern);

    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }

  /**
   * Adds the prefix to a cache key.
   * 
   * @param key - Original key
   * @returns Prefixed key
   */
  private getPrefixedKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }
}
