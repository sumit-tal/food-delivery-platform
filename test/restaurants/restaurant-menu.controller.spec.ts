import { Test, type TestingModule } from '@nestjs/testing';
import { RestaurantMenuController } from 'src/modules/restaurants/controllers/restaurant-menu.controller';
import { RestaurantMenuService } from 'src/modules/restaurants/services/restaurant-menu.service';
import { EnhancedMenuCacheService } from 'src/modules/restaurants/cache/enhanced-menu-cache.service';
import { MenuModel, MenuItemModel } from 'src/modules/restaurants/models/menu.model';

/**
 * Unit tests for RestaurantMenuController.
 */
interface ServiceMock {
  readonly menuService: {
    readonly getMenu: jest.MockedFunction<RestaurantMenuService['getMenu']>;
    readonly updateMenu: jest.MockedFunction<RestaurantMenuService['updateMenu']>;
    readonly isPopularRestaurant: jest.MockedFunction<RestaurantMenuService['isPopularRestaurant']>;
    readonly getPopularRestaurantMenus: jest.MockedFunction<RestaurantMenuService['getPopularRestaurantMenus']>;
  };
  readonly menuCache: {
    readonly getOrFetchLatest: jest.MockedFunction<EnhancedMenuCacheService['getOrFetchLatest']>;
    readonly set: jest.MockedFunction<EnhancedMenuCacheService['set']>;
    readonly warmCache: jest.MockedFunction<EnhancedMenuCacheService['warmCache']>;
  };
}

const buildMenuModel = (restaurantId: string, version = 1): MenuModel => ({
  restaurantId,
  version,
  items: [
    {
      id: 'item1',
      restaurantId,
      name: 'Spring Rolls',
      description: 'Vegetable spring rolls',
      priceCents: 599,
      currency: 'USD',
      isAvailable: true,
      imageUrl: 'https://example.com/spring-rolls.jpg'
    },
    {
      id: 'item2',
      restaurantId,
      name: 'Chicken Wings',
      description: 'Spicy buffalo wings',
      priceCents: 899,
      currency: 'USD',
      isAvailable: true
    }
  ]
});

const buildUpdatedMenuModel = (restaurantId: string): MenuModel => ({
  restaurantId,
  version: 2,
  items: [
    {
      id: 'item1',
      restaurantId,
      name: 'Spring Rolls',
      description: 'Vegetable spring rolls',
      priceCents: 599,
      currency: 'USD',
      isAvailable: true,
      imageUrl: 'https://example.com/spring-rolls.jpg'
    },
    {
      id: 'item3',
      restaurantId,
      name: 'Caesar Salad',
      description: 'Fresh caesar salad',
      priceCents: 799,
      currency: 'USD',
      isAvailable: true,
      tags: ['healthy']
    }
  ]
});

describe('RestaurantMenuController', () => {
  let controller: RestaurantMenuController;
  let service: ServiceMock;

  beforeEach(async () => {
    service = {
      menuService: {
        getMenu: jest.fn() as jest.MockedFunction<RestaurantMenuService['getMenu']>,
        updateMenu: jest.fn() as jest.MockedFunction<RestaurantMenuService['updateMenu']>,
        isPopularRestaurant: jest.fn() as jest.MockedFunction<RestaurantMenuService['isPopularRestaurant']>,
        getPopularRestaurantMenus: jest.fn() as jest.MockedFunction<RestaurantMenuService['getPopularRestaurantMenus']>
      },
      menuCache: {
        getOrFetchLatest: jest.fn() as jest.MockedFunction<EnhancedMenuCacheService['getOrFetchLatest']>,
        set: jest.fn() as jest.MockedFunction<EnhancedMenuCacheService['set']>,
        warmCache: jest.fn() as jest.MockedFunction<EnhancedMenuCacheService['warmCache']>
      }
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RestaurantMenuController],
      providers: [
        { provide: RestaurantMenuService, useValue: service.menuService },
        { provide: EnhancedMenuCacheService, useValue: service.menuCache }
      ]
    }).compile();

    controller = moduleRef.get(RestaurantMenuController);
  });

  describe('getMenu', () => {
    it('When getMenu is called for a regular restaurant Then returns menu from cache service', async () => {
      const restaurantId = 'restaurant-123';
      const menu = buildMenuModel(restaurantId);
      const isPopular = false;

      service.menuService.isPopularRestaurant.mockResolvedValue(isPopular);
      service.menuCache.getOrFetchLatest.mockResolvedValue(menu);

      const result = await controller.getMenu(restaurantId);

      expect(service.menuService.isPopularRestaurant).toHaveBeenCalledWith(restaurantId);
      expect(service.menuCache.getOrFetchLatest).toHaveBeenCalledWith(
        restaurantId,
        expect.any(Function),
        isPopular
      );
      expect(result).toBe(menu);
    });

    it('When getMenu is called for a popular restaurant Then uses popular caching strategy', async () => {
      const restaurantId = 'restaurant-456';
      const menu = buildMenuModel(restaurantId);
      const isPopular = true;

      service.menuService.isPopularRestaurant.mockResolvedValue(isPopular);
      service.menuCache.getOrFetchLatest.mockResolvedValue(menu);

      const result = await controller.getMenu(restaurantId);

      expect(service.menuService.isPopularRestaurant).toHaveBeenCalledWith(restaurantId);
      expect(service.menuCache.getOrFetchLatest).toHaveBeenCalledWith(
        restaurantId,
        expect.any(Function),
        isPopular
      );
      expect(result).toBe(menu);
    });

    it('When getMenu is called Then fetch callback calls menu service', async () => {
      const restaurantId = 'restaurant-789';
      const menu = buildMenuModel(restaurantId);
      const isPopular = false;

      service.menuService.isPopularRestaurant.mockResolvedValue(isPopular);
      service.menuService.getMenu.mockResolvedValue(menu);
      service.menuCache.getOrFetchLatest.mockImplementation(async (id, fetchCallback) => {
        return fetchCallback();
      });

      const result = await controller.getMenu(restaurantId);

      expect(service.menuService.getMenu).toHaveBeenCalledWith(restaurantId);
      expect(result).toBe(menu);
    });
  });

  describe('updateMenu', () => {
    it('When updateMenu is called Then updates menu via service and caches result', async () => {
      const restaurantId = 'restaurant-123';
      const menuInput = buildMenuModel(restaurantId, 1);
      const updatedMenu = buildUpdatedMenuModel(restaurantId);

      service.menuService.updateMenu.mockResolvedValue(updatedMenu);

      const result = await controller.updateMenu(restaurantId, menuInput);

      expect(service.menuService.updateMenu).toHaveBeenCalledWith(restaurantId, menuInput);
      expect(service.menuCache.set).toHaveBeenCalledWith(updatedMenu);
      expect(result).toBe(updatedMenu);
    });

    it('When updateMenu is called with new menu data Then returns updated menu with new version', async () => {
      const restaurantId = 'restaurant-456';
      const menuInput = buildMenuModel(restaurantId, 2);
      const updatedMenu = { ...menuInput, version: 3, lastUpdated: '2023-01-01T00:00:00.000Z' };

      service.menuService.updateMenu.mockResolvedValue(updatedMenu);

      const result = await controller.updateMenu(restaurantId, menuInput);

      expect(result.version).toBe(3);
      expect(result.restaurantId).toBe(restaurantId);
    });
  });

  describe('warmCache', () => {
    it('When warmCache is called Then fetches popular menus and warms cache', async () => {
      const popularMenus = [
        buildMenuModel('restaurant-123'),
        buildMenuModel('restaurant-456'),
        buildMenuModel('restaurant-789')
      ];

      service.menuService.getPopularRestaurantMenus.mockResolvedValue(popularMenus);

      const result = await controller.warmCache();

      expect(service.menuService.getPopularRestaurantMenus).toHaveBeenCalled();
      expect(service.menuCache.warmCache).toHaveBeenCalledWith(popularMenus);
      expect(result).toEqual({
        success: true,
        count: popularMenus.length
      });
    });

    it('When warmCache is called with empty popular menus Then returns zero count', async () => {
      const popularMenus: MenuModel[] = [];

      service.menuService.getPopularRestaurantMenus.mockResolvedValue(popularMenus);

      const result = await controller.warmCache();

      expect(service.menuCache.warmCache).toHaveBeenCalledWith(popularMenus);
      expect(result).toEqual({
        success: true,
        count: 0
      });
    });
  });

  describe('getCacheStats', () => {
    it('When getCacheStats is called Then returns placeholder message', async () => {
      const result = await controller.getCacheStats();

      expect(result).toEqual({
        message: 'Cache statistics endpoint would be implemented here'
      });
    });
  });
});
