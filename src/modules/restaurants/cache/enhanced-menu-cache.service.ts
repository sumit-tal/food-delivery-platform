import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EnhancedRedisCache } from '../../../common/cache/enhanced-redis-cache.service';
import { MenuModel } from '../models/menu.model';
import { MenuCache } from './menu-cache';

/**
 * Enhanced menu cache service that uses the advanced caching layer.
 * Implements sophisticated cache invalidation strategies to optimize system performance.
 */
@Injectable()
export class EnhancedMenuCacheService implements MenuCache {
  private readonly cache: EnhancedRedisCache<MenuModel>;
  private readonly keyPrefix = 'menu';
  private readonly menuTtl = 3600; // 1 hour for regular menu data
  private readonly popularMenuTtl = 1800; // 30 minutes for popular menus (higher traffic)
  
  /**
   * Creates a new instance of EnhancedMenuCacheService.
   * 
   * @param redisCache - The enhanced Redis cache service
   * @param eventEmitter - Event emitter for cache events
   */
  constructor(
    private readonly redisCache: EnhancedRedisCache<MenuModel>,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.cache = redisCache;
    this.setupEventListeners();
  }
  
  /**
   * Sets up event listeners for cache invalidation.
   */
  private setupEventListeners(): void {
    // Listen for menu update events
    this.eventEmitter.on('menu.updated', (payload: { restaurantId: string }) => {
      void this.invalidate(payload.restaurantId);
    });
    
    // Listen for restaurant update events that might affect menu
    this.eventEmitter.on('restaurant.updated', (payload: { restaurantId: string }) => {
      void this.invalidate(payload.restaurantId);
    });
  }
  
  /**
   * Gets the latest menu for a restaurant.
   * 
   * @param restaurantId - Restaurant ID
   * @returns The latest menu or null if not found
   */
  public async getLatest(restaurantId: string): Promise<MenuModel | null> {
    const key = this.getMenuKey(restaurantId);
    return this.cache.get(key);
  }
  
  /**
   * Gets the latest menu for a restaurant or fetches it from the database.
   * 
   * @param restaurantId - Restaurant ID
   * @param fetchCallback - Function to fetch the menu from the database
   * @param isPopular - Whether this is a popular restaurant (affects caching strategy)
   * @returns The latest menu
   */
  public async getOrFetchLatest(
    restaurantId: string,
    fetchCallback: () => Promise<MenuModel>,
    isPopular = false
  ): Promise<MenuModel> {
    const key = this.getMenuKey(restaurantId);
    
    return this.cache.getOrSet(
      key,
      fetchCallback,
      this.getCacheOptions(restaurantId, isPopular, fetchCallback)
    );
  }
  
  /**
   * Gets cache options based on restaurant popularity.
   * 
   * @param restaurantId - Restaurant ID
   * @param isPopular - Whether this is a popular restaurant
   * @param fetchCallback - Function to fetch the menu from the database
   * @returns Cache options
   */
  private getCacheOptions(
    restaurantId: string,
    isPopular: boolean,
    fetchCallback: () => Promise<MenuModel>
  ): {
    ttl: number;
    useStaggeredExpiration: boolean;
    backgroundRefresh?: boolean;
    refreshFactory?: () => Promise<MenuModel>;
    tags: string[];
  } {
    const ttl = isPopular ? this.popularMenuTtl : this.menuTtl;
    
    return {
      ttl,
      useStaggeredExpiration: isPopular, // Use staggered expiration for popular restaurants
      backgroundRefresh: isPopular, // Use background refresh for popular restaurants
      refreshFactory: isPopular ? fetchCallback : undefined,
      tags: [`restaurant:${restaurantId}`, 'menu']
    };
  }
  
  /**
   * Sets a menu in the cache.
   * 
   * @param menu - Menu to cache
   */
  public async set(menu: MenuModel): Promise<void> {
    const key = this.getMenuKey(menu.restaurantId);
    
    await this.cache.set(key, menu, {
      ttl: this.menuTtl,
      tags: [`restaurant:${menu.restaurantId}`, 'menu'],
      useStaggeredExpiration: true
    });
    
    // Store version information separately for atomic updates
    await this.setVersionInfo(menu.restaurantId, menu.version);
  }
  
  /**
   * Sets version information for a menu.
   * 
   * @param restaurantId - Restaurant ID
   * @param version - Menu version
   */
  private async setVersionInfo(restaurantId: string, version: number): Promise<void> {
    const versionKey = this.getVersionKey(restaurantId);
    await this.cache.set(versionKey, { version } as unknown as MenuModel, {
      ttl: this.menuTtl * 2 // Keep version info longer than the menu itself
    });
  }
  
  /**
   * Invalidates a menu in the cache.
   * 
   * @param restaurantId - Restaurant ID
   */
  public async invalidate(restaurantId: string): Promise<void> {
    // Create a promise that resolves when invalidation is complete
    await new Promise<void>((resolve) => {
      // Emit event to invalidate all cache entries with this restaurant's tag
      this.eventEmitter.emit('cache.invalidate', {
        tags: [`restaurant:${restaurantId}`]
      });
      
      // Resolve immediately since the actual invalidation happens asynchronously
      // In a production system, you might want to wait for confirmation
      resolve();
    });
  }
  
  /**
   * Pre-warms the cache with a batch of menus.
   * 
   * @param menus - Menus to cache
   */
  public async warmCache(menus: MenuModel[]): Promise<void> {
    for (const menu of menus) {
      await this.set(menu);
    }
  }
  
  /**
   * Gets the cache key for a menu.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Cache key
   */
  private getMenuKey(restaurantId: string): string {
    return `${this.keyPrefix}:${restaurantId}:data`;
  }
  
  /**
   * Gets the cache key for a menu version.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Cache key
   */
  private getVersionKey(restaurantId: string): string {
    return `${this.keyPrefix}:${restaurantId}:version`;
  }
}
