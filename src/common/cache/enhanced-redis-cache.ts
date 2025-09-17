import { Injectable } from '@nestjs/common';
import { createClient } from 'redis';
import { Cache, CacheOptions, CacheStats } from './cache.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Redis client options type
 */
interface RedisClientOptions {
  url: string;
  socket?: {
    connectTimeout?: number;
    commandTimeout?: number;
    reconnectStrategy?: (retries: number) => number;
  };
}

/**
 * Redis multi command interface
 */
interface RedisMulti {
  set(key: string, value: string, options?: { EX?: number; NX?: boolean }): RedisMulti;
  expire(key: string, seconds: number): RedisMulti;
  exec(): Promise<unknown>;
  sAdd(key: string, ...members: string[]): RedisMulti;
}

/**
 * Redis client interface
 */
interface RedisClient {
  connect(): Promise<void>;
  quit(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number; NX?: boolean }): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<string>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  exists(key: string): Promise<number>;
  scan(
    cursor: number,
    options: { MATCH?: string; COUNT?: number },
  ): Promise<{ cursor: number; keys: string[] }>;
  ttl(key: string): Promise<number>;
  sAdd(key: string, ...members: string[]): Promise<number>;
  sMembers(key: string): Promise<string[]>;
  sRem(key: string, ...members: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  multi(): RedisMulti;
  on(event: string, listener: (error: Error) => void): void;
  isOpen: boolean;
}

/**
 * Enhanced Redis cache implementation with advanced features:
 * - Time-based expiration
 * - Staggered expiration for cache stampede prevention
 * - Event-based cache invalidation
 * - Background refresh for high-traffic cache entries
 * - Versioned cache keys for atomic updates
 * - Cache hit/miss monitoring
 */
@Injectable()
export class EnhancedRedisCache<T = unknown> implements Cache<T> {
  private client: RedisClient | null = null;
  private readonly prefix: string;
  private readonly defaultTtl: number = 3600; // 1 hour default TTL
  private readonly lockTtl: number = 10; // 10 seconds lock TTL
  private readonly refreshWindow: number = 0.9; // Refresh when 90% of TTL has passed
  private readonly connectTimeout: number = 5000; // 5 seconds
  private readonly commandTimeout: number = 200; // 200ms for commands to meet P99 target
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRatio: 0,
    avgGetTime: 0,
    avgSetTime: 0,
    size: 0,
    timestamp: Date.now(),
  };
  private totalGetTime = 0;
  private totalSetTime = 0;
  private totalGetOperations = 0;
  private totalSetOperations = 0;
  private backgroundRefreshQueue: Map<
    string,
    { priority: number; factory: () => Promise<unknown> }
  > = new Map();
  private isRefreshProcessRunning = false;
  private readonly tagToKeysMap: Map<string, Set<string>> = new Map();

  /**
   * Creates a new instance of EnhancedRedisCache.
   *
   * @param redisUrl - Redis connection URL
   * @param eventEmitter - Event emitter for cache events
   * @param prefix - Key prefix for cache entries
   */
  constructor(
    private readonly redisUrl: string,
    private readonly eventEmitter: EventEmitter2,
    prefix?: string,
  ) {
    this.prefix = prefix ?? 'cache';
    this.setupEventListeners();
    this.startBackgroundRefreshProcess();
  }

  /**
   * Sets up event listeners for cache invalidation.
   */
  private setupEventListeners(): void {
    // Listen for cache invalidation events
    this.eventEmitter.on(
      'cache.invalidate',
      async (payload: { key?: string; pattern?: string; tags?: string[] }) => {
        if (payload.key) {
          await this.delete(payload.key);
        }

        if (payload.pattern) {
          await this.deleteByPattern(payload.pattern);
        }

        if (payload.tags && payload.tags.length > 0) {
          await this.deleteByTags(payload.tags);
        }
      },
    );
  }

  /**
   * Creates a Redis client with the configured options.
   *
   * @returns A Redis client instance
   */
  private createRedisClient(): RedisClient {
    const options: RedisClientOptions = {
      url: this.redisUrl,
      socket: {
        connectTimeout: this.connectTimeout,
        commandTimeout: this.commandTimeout,
        reconnectStrategy: (retries: number) => {
          // Exponential backoff with max delay of 10 seconds
          return Math.min(Math.pow(2, retries) * 100, 10000);
        },
      },
    };

    const client = createClient(options) as unknown as RedisClient;

    // Set up error handler
    client.on('error', (error: Error) => {
      console.error('Redis client error:', error.message);
      this.eventEmitter.emit('cache.error', { error: error.message });
    });

    return client;
  }

  /**
   * Connects to Redis if not already connected.
   */
  public async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    try {
      this.client = this.createRedisClient();

      await this.client.connect();
    } catch (error) {
      console.error(
        'Failed to connect to Redis:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Gets a value from the cache.
   *
   * @param key - Cache key
   * @returns The cached value or null if not found
   */
  public async get(key: string): Promise<T | null> {
    const startTime = Date.now();
    try {
      const client = await this.ensureClient();
      const prefixedKey = this.getPrefixedKey(key);

      const value = await client.get(prefixedKey);
      const endTime = Date.now();

      if (value) {
        // Update stats
        this.stats.hits++;
        this.totalGetTime += endTime - startTime;
        this.totalGetOperations++;
        this.stats.avgGetTime = this.totalGetTime / this.totalGetOperations;

        try {
          return JSON.parse(value) as T;
        } catch (e) {
          return value as unknown as T;
        }
      } else {
        // Update stats
        this.stats.misses++;
        this.totalGetTime += endTime - startTime;
        this.totalGetOperations++;
        this.stats.avgGetTime = this.totalGetTime / this.totalGetOperations;

        return null;
      }
    } catch (error) {
      console.error(
        'Error retrieving from cache:',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    } finally {
      this.updateHitRatio();
    }
  }

  /**
   * Sets a value in the cache.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Optional cache settings
   */
  public async set(key: string, value: T, options?: CacheOptions): Promise<void> {
    const startTime = Date.now();
    try {
      const client = await this.ensureClient();
      const prefixedKey = this.getPrefixedKey(key);

      // Determine TTL
      const ttl = options?.ttl ?? this.defaultTtl;

      // Apply staggered expiration to prevent cache stampede
      const finalTtl = options?.useStaggeredExpiration ? this.calculateStaggeredExpiry(ttl) : ttl;

      // Serialize value
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      // Store in Redis with expiry
      await client.setEx(prefixedKey, finalTtl, serializedValue);

      // Store metadata for background refresh if needed
      if (options?.backgroundRefresh && options.refreshFactory) {
        this.backgroundRefreshQueue.set(key, {
          priority: options.refreshPriority ?? 1,
          factory: options.refreshFactory,
        });
      }

      // Store tag associations
      if (options?.tags && options.tags.length > 0) {
        await this.associateKeyWithTags(key, options.tags);
      }

      // Update stats
      const endTime = Date.now();
      this.totalSetTime += endTime - startTime;
      this.totalSetOperations++;
      this.stats.avgSetTime = this.totalSetTime / this.totalSetOperations;

      // Emit event for monitoring
      this.eventEmitter.emit('cache.set', { key, ttl: finalTtl });
    } catch (error) {
      console.error('Error setting cache:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Deletes a value from the cache.
   *
   * @param key - Cache key
   * @returns True if the value was deleted, false if it wasn't found
   */
  public async delete(key: string): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const prefixedKey = this.getPrefixedKey(key);

      // Remove from background refresh queue if present
      this.backgroundRefreshQueue.delete(key);

      // Remove from tag associations
      await this.removeKeyFromTags(key);

      // Delete from Redis
      const result = await client.del(prefixedKey);

      // Emit event for monitoring
      this.eventEmitter.emit('cache.delete', { key });

      return result > 0;
    } catch (error) {
      console.error(
        'Error deleting from cache:',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Checks if a key exists in the cache.
   *
   * @param key - Cache key
   * @returns True if the key exists, false otherwise
   */
  public async has(key: string): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const prefixedKey = this.getPrefixedKey(key);

      const exists = await client.exists(prefixedKey);
      return exists > 0;
    } catch (error) {
      console.error(
        'Error checking cache key:',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Attempts to acquire a distributed lock for cache key generation.
   *
   * @param lockKey - The lock key
   * @param lockValue - The lock value
   * @returns True if lock was acquired, false otherwise
   */
  private async acquireLock(lockKey: string, lockValue: string): Promise<boolean> {
    const client = await this.ensureClient();
    return !!(await client.set(lockKey, lockValue, {
      NX: true, // Only set if key does not exist
      EX: this.lockTtl, // Lock expires after lockTtl seconds
    }));
  }

  /**
   * Releases a distributed lock if we own it.
   *
   * @param lockKey - The lock key
   * @param lockValue - Our lock value
   */
  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    try {
      const client = await this.ensureClient();
      const currentLockValue = await client.get(lockKey);
      if (currentLockValue === lockValue) {
        await client.del(lockKey);
      }
    } catch (e) {
      // Ignore errors in lock release
    }
  }

  /**
   * Waits for a value to appear in cache with retries.
   *
   * @param key - Cache key to check
   * @returns The cached value or null if not found after retries
   */
  private async waitForCachedValue(key: string): Promise<T | null> {
    // Try a few times before giving up
    for (let i = 0; i < 5; i++) {
      const retryValue = await this.get(key);
      if (retryValue !== null) {
        return retryValue;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  /**
   * Generates and caches a value when we have acquired a lock.
   *
   * @param key - Cache key
   * @param factory - Function to produce the value
   * @param options - Optional cache settings
   * @returns The generated value
   */
  private async generateAndCacheValue(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Handles the case when we failed to acquire a lock in getOrSet.
   *
   * @param key - Cache key
   * @param factory - Function to produce the value
   * @param options - Optional cache settings
   * @returns The cached or generated value
   */
  private async handleLockFailure(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Someone else is generating the value, wait for it
    await new Promise((resolve) => setTimeout(resolve, 100));
    const waitedValue = await this.waitForCachedValue(key);
    if (waitedValue !== null) {
      return waitedValue;
    }

    // If still not in cache after retries, generate it ourselves
    return await this.generateAndCacheValue(key, factory, options);
  }

  /**
   * Handles cache miss by trying to acquire a lock and generate value.
   *
   * @param key - Cache key
   * @param factory - Value factory function
   * @param options - Cache options
   * @returns Generated value
   */
  private async handleCacheMiss(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const lockKey = this.getPrefixedKey(`lock:${key}`);
    const lockValue = Date.now().toString();

    try {
      const acquired = await this.acquireLock(lockKey, lockValue);
      return acquired
        ? await this.generateAndCacheValue(key, factory, options)
        : await this.handleLockFailure(key, factory, options);
    } catch (error) {
      console.error('Error in getOrSet:', error instanceof Error ? error.message : String(error));
      return await factory(); // If anything fails, generate directly
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Gets a value from the cache or sets it if not found.
   * Implements cache stampede prevention using a distributed lock.
   *
   * @param key - Cache key
   * @param factory - Function to produce the value if not in cache
   * @param options - Optional cache settings
   * @returns The cached or newly generated value
   */
  public async getOrSet(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Try to get from cache first
    const cachedValue = await this.get(key);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // Handle cache miss with lock-based approach
    return this.handleCacheMiss(key, factory, options);
  }

  /**
   * Finds all keys with the current prefix.
   *
   * @param pattern - The pattern to match keys against
   * @returns Array of matching keys
   */
  private async findKeysByPattern(pattern: string): Promise<string[]> {
    const client = await this.ensureClient();
    let cursor = 0;
    let keys: string[] = [];

    do {
      const result = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });

      cursor = result.cursor;
      keys = keys.concat(result.keys);
    } while (cursor !== 0);

    return keys;
  }

  /**
   * Clears all entries from the cache with the current prefix.
   */
  public async clear(): Promise<void> {
    try {
      const client = await this.ensureClient();
      const pattern = `${this.prefix}:*`;

      // Find and delete all keys with our prefix
      const keys = await this.findKeysByPattern(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }

      // Clear background refresh queue and tag associations
      this.backgroundRefreshQueue.clear();
      this.tagToKeysMap.clear();

      // Reset stats
      this.resetStats();

      // Emit event for monitoring
      this.eventEmitter.emit('cache.clear', {});
    } catch (error) {
      console.error(
        'Error clearing cache:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Gets cache statistics.
   *
   * @returns Current cache statistics
   */
  public async getStats(): Promise<CacheStats> {
    // Update size stat
    await this.updateSizeStat();

    // Update timestamp
    this.stats.timestamp = Date.now();

    return { ...this.stats };
  }

  /**
   * Resets cache statistics.
   */
  public resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.hitRatio = 0;
    this.stats.avgGetTime = 0;
    this.stats.avgSetTime = 0;
    this.stats.size = 0;
    this.stats.timestamp = Date.now();
    this.totalGetTime = 0;
    this.totalSetTime = 0;
    this.totalGetOperations = 0;
    this.totalSetOperations = 0;
  }

  /**
   * Updates the hit ratio statistic.
   */
  private updateHitRatio(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRatio = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Updates the size statistic.
   */
  private async updateSizeStat(): Promise<void> {
    try {
      // No need to call ensureClient here as findKeysByPattern already does it
      const pattern = `${this.prefix}:*`;

      // Count keys with our prefix using the findKeysByPattern method
      const keys = await this.findKeysByPattern(pattern);
      this.stats.size = keys.length;
    } catch (error) {
      console.error(
        'Error updating size stat:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Calculates a staggered expiry time to prevent cache stampede.
   *
   * @param ttl - Base TTL in seconds
   * @returns Staggered TTL in seconds
   */
  private calculateStaggeredExpiry(ttl: number): number {
    // Add random jitter of +/- 15% to the TTL
    const jitterFactor = 0.15;
    const jitter = ttl * jitterFactor;
    const min = ttl - jitter;
    const max = ttl + jitter;
    return Math.floor(min + Math.random() * (max - min));
  }

  /**
   * Ensures Redis client is connected.
   * @returns The connected Redis client
   * @throws Error if client cannot be connected
   */
  private async ensureClient(): Promise<RedisClient> {
    if (!this.client) {
      await this.connect();
    } else if (!this.client.isOpen) {
      try {
        await this.client.connect();
      } catch (error) {
        console.error(
          'Failed to reconnect to Redis:',
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    }

    if (!this.client) {
      throw new Error('Failed to initialize Redis client');
    }

    return this.client;
  }

  /**
   * Gets the prefixed key.
   *
   * @param key - Original key
   * @returns Prefixed key
   */
  private getPrefixedKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Starts the background refresh process.
   */
  private startBackgroundRefreshProcess(): void {
    setInterval(async () => {
      if (this.isRefreshProcessRunning || this.backgroundRefreshQueue.size === 0) {
        return;
      }

      this.isRefreshProcessRunning = true;

      try {
        // Sort by priority (higher first)
        const entries = Array.from(this.backgroundRefreshQueue.entries()).sort(
          (a, b) => b[1].priority - a[1].priority,
        );

        // Process up to 10 entries at a time
        const batch = entries.slice(0, 10);

        for (const [key, { factory }] of batch) {
          try {
            // Check if key exists and is close to expiry
            const prefixedKey = this.getPrefixedKey(key);
            const ttl = await this.client!.ttl(prefixedKey);

            // If TTL is negative, key doesn't exist or has no expiry
            if (ttl < 0) {
              this.backgroundRefreshQueue.delete(key);
              continue;
            }

            // If TTL is less than refreshWindow * original TTL, refresh it
            const originalTtl = await this.client!.get(`${prefixedKey}:originalTtl`);
            const originalTtlNum = originalTtl ? parseInt(originalTtl, 10) : this.defaultTtl;

            if (ttl <= originalTtlNum * this.refreshWindow) {
              // Generate new value
              const value = await factory();

              // Store with original TTL
              await this.set(key, value as T, { ttl: originalTtlNum });

              // Store original TTL for future reference
              await this.client!.set(`${prefixedKey}:originalTtl`, originalTtlNum.toString());
            }
          } catch (error) {
            console.error(
              `Error refreshing cache key ${key}:`,
              error instanceof Error ? error.message : String(error),
            );
          }
        }
      } finally {
        this.isRefreshProcessRunning = false;
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Updates the in-memory tag map for a key.
   *
   * @param tag - The tag to update
   * @param key - The key to associate with the tag
   */
  private updateTagMap(tag: string, key: string): void {
    if (!this.tagToKeysMap.has(tag)) {
      this.tagToKeysMap.set(tag, new Set());
    }
    const tagSet = this.tagToKeysMap.get(tag);
    if (tagSet) {
      tagSet.add(key);
    }
  }

  /**
   * Associates a key with tags for grouped invalidation.
   *
   * @param key - Cache key
   * @param tags - Tags to associate with the key
   */
  private async associateKeyWithTags(key: string, tags: string[]): Promise<void> {
    try {
      const client = await this.ensureClient();

      // Update in-memory maps and Redis for each tag
      for (const tag of tags) {
        this.updateTagMap(tag, key);
        const tagKey = this.getPrefixedKey(`tag:${tag}`);
        await client.sAdd(tagKey, key);
      }

      // Store tags for this key
      const keyTagsKey = this.getPrefixedKey(`key:${key}:tags`);
      await client.sAdd(keyTagsKey, ...tags);
    } catch (error) {
      console.error(
        'Error associating key with tags:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Removes a key from a specific tag in memory and Redis.
   *
   * @param key - Cache key to remove
   * @param tag - Tag to remove the key from
   * @param client - Redis client
   */
  private async removeKeyFromTag(key: string, tag: string, client: RedisClient): Promise<void> {
    // Update in-memory map
    const tagSet = this.tagToKeysMap.get(tag);
    if (tagSet) {
      tagSet.delete(key);
    }

    // Update in Redis
    const tagKey = this.getPrefixedKey(`tag:${tag}`);
    await client.sRem(tagKey, key);
  }

  /**
   * Removes a key from all its associated tags.
   *
   * @param key - Cache key
   */
  private async removeKeyFromTags(key: string): Promise<void> {
    try {
      const client = await this.ensureClient();
      const keyTagsKey = this.getPrefixedKey(`key:${key}:tags`);
      const tags = await client.sMembers(keyTagsKey);

      // Remove key from each tag
      for (const tag of tags) {
        await this.removeKeyFromTag(key, tag, client);
      }

      // Delete the key's tags set
      await client.del(keyTagsKey);
    } catch (error) {
      console.error(
        'Error removing key from tags:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Deletes all keys associated with the given tags.
   *
   * @param tags - Tags whose associated keys should be deleted
   */
  public async deleteByTags(tags: string[]): Promise<void> {
    try {
      const client = await this.ensureClient();

      for (const tag of tags) {
        // Get keys for this tag
        const tagKey = this.getPrefixedKey(`tag:${tag}`);
        const keys = await client.sMembers(tagKey);

        // Delete each key
        for (const key of keys) {
          await this.delete(key);
        }

        // Delete the tag set
        await client.del(tagKey);

        // Update in-memory map
        this.tagToKeysMap.delete(tag);
      }

      // Emit event for monitoring
      this.eventEmitter.emit('cache.deleteByTags', { tags });
    } catch (error) {
      console.error(
        'Error deleting by tags:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Deletes all keys matching a pattern.
   *
   * @param pattern - Pattern to match keys against
   */
  public async deleteByPattern(pattern: string): Promise<void> {
    try {
      await this.ensureClient();
      const fullPattern = this.getPrefixedKey(pattern);

      // Find all keys matching the pattern using the findKeysByPattern method
      const keys = await this.findKeysByPattern(fullPattern);

      // Delete all found keys
      if (keys.length > 0) {
        for (const key of keys) {
          // Extract the original key (without prefix)
          const originalKey = key.substring(this.prefix.length + 1);
          await this.delete(originalKey);
        }
      }

      // Emit event for monitoring
      this.eventEmitter.emit('cache.deleteByPattern', { pattern });
    } catch (error) {
      console.error(
        'Error deleting by pattern:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
