import { Injectable } from '@nestjs/common';
import { createClient } from 'redis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cache, CacheOptions, CacheStats } from './cache.interface';

// Redis client options are used in createRedisClient method

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
  scan(cursor: number, options: { MATCH?: string; COUNT?: number }): Promise<{ cursor: number; keys: string[] }>;
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
  private totalSetOperations = 0;
  private totalGetOperations = 0;
  private totalSetTime = 0;
  private backgroundRefreshQueue: Map<string, { priority: number; factory: () => Promise<T> }> = new Map();
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
    prefix?: string
  ) {
    this.prefix = prefix ?? 'cache';
    this.setupEventListeners();
    this.startBackgroundRefreshProcess();
  }

  /**
   * Sets up event listeners for cache invalidation.
   */
  private setupEventListeners(): void {
    this.eventEmitter.on(
      'cache.invalidate', 
      (payload: { key?: string; pattern?: string; tags?: string[] }) => {
        if (payload.key) {
          void this.delete(payload.key);
        }
        
        if (payload.pattern) {
          void this.deleteByPattern(payload.pattern);
        }
        
        if (payload.tags && payload.tags.length > 0) {
          void this.deleteByTags(payload.tags);
        }
      }
    );
  }

  /**
   * Connects to Redis if not already connected.
   */
  public async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    try {
      const client = await this.createRedisClient();
      this.client = client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to connect to Redis:', errorMessage);
      throw error;
    }
  }

  /**
   * Creates and configures a new Redis client.
   * 
   * @returns Configured Redis client
   */
  private async createRedisClient(): Promise<RedisClient> {
    const options = {
      url: this.redisUrl,
      socket: {
        connectTimeout: this.connectTimeout,
        commandTimeout: this.commandTimeout,
        reconnectStrategy: (retries: number): number => Math.min(retries * 100, 3000),
      }
    } as unknown as { url: string };

    const client = createClient(options) as unknown as RedisClient;
    
    client.on('error', (err: Error): void => {
      console.error('Redis client error:', err);
    });
    
    await client.connect();
    return client;
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
      await this.ensureClient();
      const value = await this.retrieveFromCache(key);
      this.updateGetStats(startTime, !!value);
      return value;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error retrieving from cache:', errorMessage);
      return null;
    }
  }

  /**
   * Retrieves a value from the cache and deserializes it.
   * 
   * @param key - Cache key
   * @returns Deserialized value or null if not found
   */
  private async retrieveFromCache(key: string): Promise<T | null> {
    const prefixedKey = this.getPrefixedKey(key);
    const value = await this.client?.get(prefixedKey);
    
    if (!value) {
      return null;
    }
    
    return this.deserializeValue(value);
  }

  /**
   * Deserializes a string value from the cache.
   * 
   * @param value - Serialized value
   * @returns Deserialized value
   */
  private deserializeValue(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Updates statistics for get operations.
   * 
   * @param startTime - Start time of the operation
   * @param isHit - Whether the operation was a cache hit
   */
  private updateGetStats(startTime: number, isHit: boolean): void {
    const endTime = Date.now();
    
    if (isHit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    this.totalGetTime += (endTime - startTime);
    this.totalGetOperations++;
    this.stats.avgGetTime = this.totalGetTime / this.totalGetOperations;
    this.updateHitRatio();
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
      await this.ensureClient();
      await this.setWithOptions(key, value, options);
      this.updateSetStats(startTime);
      
      await this.handleCacheMetadata(key, value, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error setting cache:', errorMessage);
    }
  }
  
  /**
   * Handles cache metadata like background refresh and tags.
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Optional cache settings
   */
  private async handleCacheMetadata(key: string, value: T, options?: CacheOptions): Promise<void> {
    // Store metadata for background refresh if needed
    if (options?.backgroundRefresh && options.refreshFactory) {
      this.backgroundRefreshQueue.set(key, {
        priority: options.refreshPriority ?? 1,
        factory: options.refreshFactory as () => Promise<T>,
      });
    }
    
    // Store tag associations
    if (options?.tags && options.tags.length > 0) {
      await this.associateKeyWithTags(key, options.tags);
    }
    
    // Emit event for monitoring
    this.eventEmitter.emit('cache.set', { key, ttl: options?.ttl ?? this.defaultTtl });
  }

  /**
   * Sets a value in the cache with the specified options.
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Optional cache settings
   */
  private async setWithOptions(key: string, value: T, options?: CacheOptions): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    
    // Determine TTL
    const ttl = options?.ttl ?? this.defaultTtl;
    
    // Apply staggered expiration to prevent cache stampede
    const finalTtl = options?.useStaggeredExpiration 
      ? this.calculateStaggeredExpiry(ttl)
      : ttl;
    
    // Serialize value
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Store in Redis with expiry
    await this.client?.setEx(prefixedKey, finalTtl, serializedValue);
  }

  /**
   * Updates statistics for set operations.
   * 
   * @param startTime - Start time of the operation
   */
  private updateSetStats(startTime: number): void {
    const endTime = Date.now();
    this.totalSetTime += (endTime - startTime);
    this.totalSetOperations++;
    this.stats.avgSetTime = this.totalSetTime / this.totalSetOperations;
  }

  /**
   * Deletes a value from the cache.
   * 
   * @param key - Cache key
   * @returns True if the value was deleted, false if it wasn't found
   */
  public async delete(key: string): Promise<boolean> {
    try {
      await this.ensureClient();
      const prefixedKey = this.getPrefixedKey(key);
      
      // Remove from background refresh queue if present
      this.backgroundRefreshQueue.delete(key);
      
      // Remove from tag associations
      await this.removeKeyFromTags(key);
      
      // Delete from Redis
      const result = await this.client?.del(prefixedKey) ?? 0;
      
      // Emit event for monitoring
      this.eventEmitter.emit('cache.delete', { key });
      
      return result > 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error deleting from cache:', errorMessage);
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
      await this.ensureClient();
      const prefixedKey = this.getPrefixedKey(key);
      
      const exists = await this.client?.exists(prefixedKey) ?? 0;
      return exists > 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error checking cache key:', errorMessage);
      return false;
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
  public async getOrSet(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    // Try to get from cache first
    const cachedValue = await this.get(key);
    if (cachedValue !== null) {
      return cachedValue;
    }
    
    return this.getOrSetWithLock(key, factory, options);
  }

  /**
   * Gets a value using a lock to prevent cache stampede.
   * 
   * @param key - Cache key
   * @param factory - Function to produce the value
   * @param options - Optional cache settings
   * @returns The generated value
   */
  private async getOrSetWithLock(
    key: string, 
    factory: () => Promise<T>, 
    options?: CacheOptions
  ): Promise<T> {
    const lockKey = this.getPrefixedKey(`lock:${key}`);
    const lockValue = Date.now().toString();
    
    try {
      await this.ensureClient();
      const acquired = await this.acquireLock(lockKey, lockValue);
      return await this.handleLockResult(key, factory, options, acquired);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error in getOrSet:', errorMessage);
      return factory();
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }
  
  /**
   * Handles the result of a lock acquisition attempt.
   * 
   * @param key - Cache key
   * @param factory - Function to produce the value
   * @param options - Optional cache settings
   * @param acquired - Whether the lock was acquired
   * @returns The cached or generated value
   */
  private async handleLockResult(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
    acquired?: boolean
  ): Promise<T> {
    if (acquired) {
      return this.generateAndCacheValue(key, factory, options);
    } else {
      return this.waitForValueOrGenerate(key, factory, options);
    }
  }
  
  /**
   * Attempts to acquire a distributed lock.
   * 
   * @param lockKey - Lock key
   * @param lockValue - Lock value
   * @returns Whether the lock was acquired
   */
  private async acquireLock(lockKey: string, lockValue: string): Promise<boolean> {
    return !!await this.client?.set(lockKey, lockValue, {
      NX: true, // Only set if key does not exist
      EX: this.lockTtl // Lock expires after lockTtl seconds
    });
  }

  /**
   * Generates and caches a value.
   * 
   * @param key - Cache key
   * @param factory - Function to produce the value
   * @param options - Optional cache settings
   * @returns The generated value
   */
  private async generateAndCacheValue(
    key: string, 
    factory: () => Promise<T>, 
    options?: CacheOptions
  ): Promise<T> {
    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Waits for a value to be generated or generates it if not available after retries.
   * 
   * @param key - Cache key
   * @param factory - Function to produce the value
   * @param options - Optional cache settings
   * @returns The cached or generated value
   */
  private async waitForValueOrGenerate(
    key: string, 
    factory: () => Promise<T>, 
    options?: CacheOptions
  ): Promise<T> {
    // Wait a bit and try to get from cache again
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Try a few times before giving up
    for (let i = 0; i < 5; i++) {
      const retryValue = await this.get(key);
      if (retryValue !== null) {
        return retryValue;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // If still not in cache after retries, generate it ourselves
    return this.generateAndCacheValue(key, factory, options);
  }

  /**
   * Releases a lock if we acquired it.
   * 
   * @param lockKey - Lock key
   * @param lockValue - Lock value
   */
  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    try {
      const currentLockValue = await this.client?.get(lockKey);
      if (currentLockValue === lockValue) {
        await this.client?.del(lockKey);
      }
    } catch (e) {
      // Ignore errors in lock release
    }
  }

  /**
   * Clears all entries from the cache with the current prefix.
   */
  public async clear(): Promise<void> {
    try {
      await this.ensureClient();
      await this.clearCacheEntries();
      
      // Clear background refresh queue and tag associations
      this.backgroundRefreshQueue.clear();
      this.tagToKeysMap.clear();
      
      // Reset stats
      this.resetStats();
      
      // Emit event for monitoring
      this.eventEmitter.emit('cache.clear', {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error clearing cache:', errorMessage);
    }
  }

  /**
   * Clears all cache entries with the current prefix.
   */
  private async clearCacheEntries(): Promise<void> {
    const pattern = `${this.prefix}:*`;
    
    // Find all keys with our prefix
    let cursor = 0;
    let keys: string[] = [];
    
    do {
      const result = await this.client?.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      
      if (!result) break;
      
      cursor = result.cursor;
      keys = keys.concat(result.keys);
    } while (cursor !== 0);
    
    // Delete all found keys
    if (keys.length > 0) {
      await this.client?.del(...keys);
    }
  }

  /**
   * Gets cache statistics.
   * 
   * @returns Current cache statistics
   */
  public getStats(): CacheStats {
    // Update size stat
    void this.updateSizeStat();
    
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
      await this.ensureClient();
      const count = await this.countCacheKeys();
      this.stats.size = count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error updating size stat:', errorMessage);
    }
  }
  
  /**
   * Counts the number of keys in the cache with the current prefix.
   * 
   * @returns Number of keys in the cache
   */
  private async countCacheKeys(): Promise<number> {
    const pattern = `${this.prefix}:*`;
    let cursor = 0;
    let count = 0;
    
    do {
      const result = await this.client?.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      
      if (!result) break;
      
      cursor = result.cursor;
      count += result.keys.length;
    } while (cursor !== 0);
    
    return count;
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
   */
  private async ensureClient(): Promise<void> {
    if (!this.client) {
      await this.connect();
    } else if (!this.client.isOpen) {
      try {
        await this.client.connect();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to reconnect to Redis:', errorMessage);
        throw error;
      }
    }
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
    setInterval(() => {
      void this.processBackgroundRefreshQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Processes the background refresh queue.
   */
  private async processBackgroundRefreshQueue(): Promise<void> {
    if (this.isRefreshProcessRunning || this.backgroundRefreshQueue.size === 0) {
      return;
    }
    
    this.isRefreshProcessRunning = true;
    
    try {
      await this.refreshHighPriorityEntries();
    } finally {
      this.isRefreshProcessRunning = false;
    }
  }

  /**
   * Refreshes high priority cache entries.
   */
  private async refreshHighPriorityEntries(): Promise<void> {
    // Sort by priority (higher first)
    const entries = Array.from(this.backgroundRefreshQueue.entries())
      .sort((a, b) => b[1].priority - a[1].priority);
    
    // Process up to 10 entries at a time
    const batch = entries.slice(0, 10);
    
    for (const [key, { factory }] of batch) {
      await this.refreshEntryIfNeeded(key, factory);
    }
  }

  /**
   * Refreshes a cache entry if it's close to expiration.
   * 
   * @param key - Cache key
   * @param factory - Function to produce the new value
   */
  private async refreshEntryIfNeeded(key: string, factory: () => Promise<T>): Promise<void> {
    try {
      await this.ensureClient();
      const shouldRefresh = await this.shouldRefreshEntry(key);
      
      if (shouldRefresh.refresh) {
        await this.refreshEntry(key, factory, shouldRefresh.originalTtl);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error refreshing cache key ${key}:`, errorMessage);
    }
  }
  
  /**
   * Checks if a cache entry should be refreshed.
   * 
   * @param key - Cache key
   * @returns Object indicating if refresh is needed and original TTL
   */
  private async shouldRefreshEntry(key: string): Promise<{ refresh: boolean; originalTtl: number }> {
    const prefixedKey = this.getPrefixedKey(key);
    const ttl = await this.client?.ttl(prefixedKey) ?? -1;
    
    // If TTL is negative, key doesn't exist or has no expiry
    if (ttl < 0) {
      this.backgroundRefreshQueue.delete(key);
      return { refresh: false, originalTtl: 0 };
    }
    
    // Get original TTL
    const originalTtlKey = `${prefixedKey}:originalTtl`;
    const originalTtl = await this.client?.get(originalTtlKey);
    const originalTtlNum = originalTtl ? parseInt(originalTtl, 10) : this.defaultTtl;
    
    // Check if TTL is less than refreshWindow * original TTL
    return { 
      refresh: ttl <= originalTtlNum * this.refreshWindow,
      originalTtl: originalTtlNum
    };
  }
  
  /**
   * Refreshes a cache entry with a new value.
   * 
   * @param key - Cache key
   * @param factory - Function to produce the new value
   * @param originalTtl - Original TTL for the entry
   */
  private async refreshEntry(key: string, factory: () => Promise<T>, originalTtl: number): Promise<void> {
    // Generate new value
    const value = await factory();
    
    // Store with original TTL
    await this.set(key, value, { ttl: originalTtl });
    
    // Store original TTL for future reference
    const prefixedKey = this.getPrefixedKey(key);
    const originalTtlKey = `${prefixedKey}:originalTtl`;
    await this.client?.set(originalTtlKey, originalTtl.toString());
  }

  /**
   * Associates a key with tags for grouped invalidation.
   * 
   * @param key - Cache key
   * @param tags - Tags to associate with the key
   */
  private async associateKeyWithTags(key: string, tags: string[]): Promise<void> {
    try {
      await this.ensureClient();
      
      for (const tag of tags) {
        // Update in-memory map
        if (!this.tagToKeysMap.has(tag)) {
          this.tagToKeysMap.set(tag, new Set());
        }
        this.tagToKeysMap.get(tag)?.add(key);
        
        // Store in Redis for persistence
        const tagKey = this.getPrefixedKey(`tag:${tag}`);
        await this.client?.sAdd(tagKey, key);
      }
      
      // Store tags for this key
      const keyTagsKey = this.getPrefixedKey(`key:${key}:tags`);
      await this.client?.sAdd(keyTagsKey, ...tags);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error associating key with tags:', errorMessage);
    }
  }

  /**
   * Removes a key from all its associated tags.
   * 
   * @param key - Cache key
   */
  private async removeKeyFromTags(key: string): Promise<void> {
    try {
      await this.ensureClient();
      
      // Get tags for this key
      const keyTagsKey = this.getPrefixedKey(`key:${key}:tags`);
      const tags = await this.client?.sMembers(keyTagsKey) ?? [];
      
      // Remove key from each tag
      for (const tag of tags) {
        // Update in-memory map
        if (this.tagToKeysMap.has(tag)) {
          this.tagToKeysMap.get(tag)?.delete(key);
        }
        
        // Update in Redis
        const tagKey = this.getPrefixedKey(`tag:${tag}`);
        await this.client?.sRem(tagKey, key);
      }
      
      // Delete the key's tags set
      await this.client?.del(keyTagsKey);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error removing key from tags:', errorMessage);
    }
  }

  /**
   * Deletes all keys associated with the given tags.
   * 
   * @param tags - Tags whose associated keys should be deleted
   */
  public async deleteByTags(tags: string[]): Promise<void> {
    try {
      await this.ensureClient();
      
      for (const tag of tags) {
        await this.deleteKeysByTag(tag);
      }
      
      // Emit event for monitoring
      this.eventEmitter.emit('cache.deleteByTags', { tags });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error deleting by tags:', errorMessage);
    }
  }

  /**
   * Deletes all keys associated with a specific tag.
   * 
   * @param tag - Tag whose associated keys should be deleted
   */
  private async deleteKeysByTag(tag: string): Promise<void> {
    // Get keys for this tag
    const tagKey = this.getPrefixedKey(`tag:${tag}`);
    const keys = await this.client?.sMembers(tagKey) ?? [];
    
    // Delete each key
    for (const key of keys) {
      await this.delete(key);
    }
    
    // Delete the tag set
    await this.client?.del(tagKey);
    
    // Update in-memory map
    this.tagToKeysMap.delete(tag);
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
      
      // Find all keys matching the pattern
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error deleting by pattern:', errorMessage);
    }
  }

  /**
   * Finds all keys matching a pattern.
   * 
   * @param fullPattern - Full pattern including prefix
   * @returns List of matching keys
   */
  private async findKeysByPattern(fullPattern: string): Promise<string[]> {
    let cursor = 0;
    let keys: string[] = [];
    
    do {
      const result = await this.client?.scan(cursor, {
        MATCH: fullPattern,
        COUNT: 100
      });
      
      if (!result) break;
      
      cursor = result.cursor;
      keys = keys.concat(result.keys);
    } while (cursor !== 0);
    
    return keys;
  }
}
