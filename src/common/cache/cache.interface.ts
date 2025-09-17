/**
 * Generic cache interface for storing and retrieving data.
 */
export interface Cache<T = unknown> {
  /**
   * Gets a value from the cache.
   * 
   * @param key - Cache key
   * @returns The cached value or null if not found
   */
  get(key: string): Promise<T | null>;

  /**
   * Sets a value in the cache.
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Optional cache settings
   */
  set(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Deletes a value from the cache.
   * 
   * @param key - Cache key
   * @returns True if the value was deleted, false if it wasn't found
   */
  delete(key: string): Promise<boolean>;

  /**
   * Checks if a key exists in the cache.
   * 
   * @param key - Cache key
   * @returns True if the key exists, false otherwise
   */
  has(key: string): Promise<boolean>;

  /**
   * Gets a value from the cache or sets it if not found.
   * 
   * @param key - Cache key
   * @param factory - Function to produce the value if not in cache
   * @param options - Optional cache settings
   * @returns The cached or newly generated value
   */
  getOrSet(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T>;

  /**
   * Clears all entries from the cache.
   */
  clear(): Promise<void>;
}

/**
 * Options for cache operations.
 */
export interface CacheOptions {
  /**
   * Time to live in seconds.
   */
  ttl?: number;

  /**
   * Whether to use staggered expiration to prevent cache stampede.
   */
  useStaggeredExpiration?: boolean;

  /**
   * Tags for the cache entry, used for grouped invalidation.
   */
  tags?: string[];

  /**
   * Priority for background refresh (higher number = higher priority).
   */
  refreshPriority?: number;

  /**
   * Whether to enable background refresh before expiration.
   */
  backgroundRefresh?: boolean;

  /**
   * Function to generate a new value for background refresh.
   */
  refreshFactory?: () => Promise<unknown>;
}

/**
 * Cache statistics for monitoring.
 */
export interface CacheStats {
  /**
   * Number of cache hits.
   */
  hits: number;

  /**
   * Number of cache misses.
   */
  misses: number;

  /**
   * Hit ratio (hits / (hits + misses)).
   */
  hitRatio: number;

  /**
   * Average time to retrieve from cache in milliseconds.
   */
  avgGetTime: number;

  /**
   * Average time to set in cache in milliseconds.
   */
  avgSetTime: number;

  /**
   * Total number of entries in the cache.
   */
  size: number;

  /**
   * Timestamp when the stats were collected.
   */
  timestamp: number;
}
