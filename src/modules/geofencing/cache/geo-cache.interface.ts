/**
 * Interface for a geographic data cache.
 */
export interface GeoCache {
  /**
   * Gets a value from the cache.
   * 
   * @param key - Cache key
   * @returns The cached value or undefined if not found
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Sets a value in the cache.
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds (optional)
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Deletes a value from the cache.
   * 
   * @param key - Cache key
   * @returns True if the value was deleted, false if it wasn't found
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clears the entire cache.
   */
  clear(): Promise<void>;
}
