import { Injectable } from '@nestjs/common';
import { MenuModel, MenuItemModel } from '../models/menu.model';

/**
 * Service for restaurant menu operations.
 */
@Injectable()
export class RestaurantMenuService {
  /**
   * Gets a restaurant's menu from the database.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Restaurant menu
   */
  public async getMenu(restaurantId: string): Promise<MenuModel> {
    // Simulate database access with a delay
    await this.simulateDbDelay();
    
    // Return sample menu data
    return this.createSampleMenu(restaurantId);
  }
  
  /**
   * Creates a sample menu for demonstration purposes.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Sample menu
   */
  private createSampleMenu(restaurantId: string): MenuModel {
    // Create sample menu items
    const items: MenuItemModel[] = this.createSampleMenuItems(restaurantId);
    
    // Return menu according to the MenuModel interface
    return {
      restaurantId,
      version: 1,
      items
    };
  }
  
  /**
   * Creates sample menu items for demonstration purposes.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Array of sample menu items
   */
  private createSampleMenuItems(restaurantId: string): MenuItemModel[] {
    const appetizers = this.createAppetizerItems(restaurantId);
    return appetizers;
  }
  
  /**
   * Creates appetizer menu items.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Array of appetizer menu items
   */
  private createAppetizerItems(restaurantId: string): MenuItemModel[] {
    return [
      this.createSpringRollItem(restaurantId),
      this.createChickenWingsItem(restaurantId)
    ];
  }
  
  /**
   * Creates a spring roll menu item.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Spring roll menu item
   */
  private createSpringRollItem(restaurantId: string): MenuItemModel {
    return {
      id: 'item1',
      restaurantId,
      name: 'Spring Rolls',
      description: 'Vegetable spring rolls',
      priceCents: 599,
      currency: 'USD',
      isAvailable: true,
      imageUrl: 'https://example.com/spring-rolls.jpg'
    };
  }
  
  /**
   * Creates a chicken wings menu item.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Chicken wings menu item
   */
  private createChickenWingsItem(restaurantId: string): MenuItemModel {
    return {
      id: 'item2',
      restaurantId,
      name: 'Chicken Wings',
      description: 'Spicy buffalo wings',
      priceCents: 899,
      currency: 'USD',
      isAvailable: true
    };
  }

  /**
   * Updates a restaurant's menu in the database.
   * 
   * @param restaurantId - Restaurant ID
   * @param menu - Updated menu
   * @returns Updated menu with new version
   */
  public async updateMenu(restaurantId: string, menu: MenuModel): Promise<MenuModel> {
    // Simulate database access with a delay
    await this.simulateDbDelay();
    
    // This would update the database in a real implementation
    const updatedMenu = {
      ...menu,
      version: menu.version + 1,
      lastUpdated: new Date().toISOString()
    };
    
    return updatedMenu;
  }

  /**
   * Checks if a restaurant is popular based on analytics.
   * 
   * @param restaurantId - Restaurant ID
   * @returns Whether the restaurant is popular
   */
  public async isPopularRestaurant(restaurantId: string): Promise<boolean> {
    // Simulate analytics data access with a delay
    await this.simulateDbDelay();
    
    // This would check analytics data in a real implementation
    // For now, just return true for certain IDs as an example
    const popularIds = ['123', '456', '789'];
    return popularIds.includes(restaurantId);
  }

  /**
   * Gets menus for popular restaurants.
   * 
   * @returns Array of popular restaurant menus
   */
  public async getPopularRestaurantMenus(): Promise<MenuModel[]> {
    // This would fetch from the database in a real implementation
    const popularIds = ['123', '456', '789'];
    
    const menus: MenuModel[] = [];
    
    for (const id of popularIds) {
      menus.push(await this.getMenu(id));
    }
    
    return menus;
  }
  
  /**
   * Simulates a database delay for demonstration purposes.
   */
  private async simulateDbDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
