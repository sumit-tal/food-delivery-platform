import { Controller, Get, Param, Post, Body, Put } from '@nestjs/common';
import { EnhancedMenuCacheService } from '../cache/enhanced-menu-cache.service';
import { MenuModel } from '../models/menu.model';
import { RestaurantMenuService } from '../services/restaurant-menu.service';

/**
 * Controller for restaurant menu operations with enhanced caching.
 */
@Controller('restaurants')
export class RestaurantMenuController {
  /**
   * Creates a new instance of RestaurantMenuController.
   * 
   * @param menuService - Restaurant menu service
   * @param menuCache - Enhanced menu cache service
   */
  constructor(
    private readonly menuService: RestaurantMenuService,
    private readonly menuCache: EnhancedMenuCacheService
  ) {}

  /**
   * Gets a restaurant's menu with caching.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Restaurant menu
   */
  @Get(':restaurantId/menu')
  async getMenu(@Param('restaurantId') restaurantId: string): Promise<MenuModel> {
    // Check if restaurant is popular (this would be determined by your analytics)
    const isPopular = await this.menuService.isPopularRestaurant(restaurantId);
    
    // Get from cache or fetch from database with appropriate caching strategy
    return this.menuCache.getOrFetchLatest(
      restaurantId,
      () => this.menuService.getMenu(restaurantId),
      isPopular
    );
  }

  /**
   * Updates a restaurant's menu and invalidates cache.
   * 
   * @param restaurantId - Restaurant ID
   * @param menu - Updated menu
   * @returns Updated menu
   */
  @Put(':restaurantId/menu')
  async updateMenu(
    @Param('restaurantId') restaurantId: string,
    @Body() menu: MenuModel
  ): Promise<MenuModel> {
    // Update menu in database
    const updatedMenu = await this.menuService.updateMenu(restaurantId, menu);
    
    // Update cache
    await this.menuCache.set(updatedMenu);
    
    return updatedMenu;
  }

  /**
   * Pre-warms the cache with popular restaurant menus.
   * This would typically be called by a scheduled job.
   */
  @Post('cache/warm')
  async warmCache(): Promise<{ success: boolean; count: number }> {
    // Get popular restaurant menus
    const popularMenus = await this.menuService.getPopularRestaurantMenus();
    
    // Warm cache
    await this.menuCache.warmCache(popularMenus);
    
    return { 
      success: true, 
      count: popularMenus.length 
    };
  }

  /**
   * Gets cache statistics for monitoring.
   * 
   * @returns Cache statistics
   */
  @Get('cache/stats')
  async getCacheStats(): Promise<{ message: string }> {
    // This would be implemented by extending the EnhancedMenuCacheService
    // to expose the underlying cache statistics
    await Promise.resolve(); // Ensure we have an await expression
    return { 
      message: 'Cache statistics endpoint would be implemented here' 
    };
  }
}
