import { Injectable } from '@nestjs/common';
import { GeoCache } from './geo-cache.interface';

/**
 * In-memory implementation of the GeoCache interface.
 */
@Injectable()
export class InMemoryGeoCache implements GeoCache {
  private readonly cache: Map<string, { value: any; expiresAt?: number }>;

  constructor() {
    this.cache = new Map<string, { value: any; expiresAt?: number }>();
  }

  /**
   * Gets a value from the cache.
   * 
   * @param key - Cache key
   * @returns The cached value or undefined if not found or expired
   */
  public async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if the entry has expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Sets a value in the cache.
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds (optional)
   */
  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const entry = {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    };

    this.cache.set(key, entry);
  }

  /**
   * Deletes a value from the cache.
   * 
   * @param key - Cache key
   * @returns True if the value was deleted, false if it wasn't found
   */
  public async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  /**
   * Clears the entire cache.
   */
  public async clear(): Promise<void> {
    this.cache.clear();
  }
}
