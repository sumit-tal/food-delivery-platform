import { RestaurantMenuService } from 'src/modules/restaurants/services/restaurant-menu.service';
import type { MenuItemModel, MenuModel } from 'src/modules/restaurants/models/menu.model';

/**
 * Builders for menu models used in tests.
 */
const buildItem = (overrides: Partial<MenuItemModel> = {}): MenuItemModel => ({
  id: overrides.id ?? 'i1',
  restaurantId: overrides.restaurantId ?? 'rid-1',
  name: overrides.name ?? 'Item',
  description: overrides.description,
  priceCents: overrides.priceCents ?? 100,
  currency: overrides.currency ?? 'USD',
  isAvailable: overrides.isAvailable ?? true,
  tags: overrides.tags,
  imageUrl: overrides.imageUrl,
});

const buildMenu = (overrides: Partial<MenuModel> = {}): MenuModel => ({
  restaurantId: overrides.restaurantId ?? 'rid-1',
  version: overrides.version ?? 1,
  items: overrides.items ?? [buildItem(), buildItem({ id: 'i2' })],
});

describe('RestaurantMenuService', () => {
  let service: RestaurantMenuService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new RestaurantMenuService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getMenu', () => {
    it('When called Then returns a sample menu for the restaurant', async () => {
      const restaurantId = 'rid-42';

      const promise = service.getMenu(restaurantId);
      await jest.runAllTimersAsync();
      const menu = await promise;

      expect(menu.restaurantId).toBe(restaurantId);
      expect(menu.version).toBe(1);
      expect(menu.items.length).toBeGreaterThanOrEqual(2);

      const names = menu.items.map((i) => i.name);
      expect(names).toEqual(expect.arrayContaining(['Spring Rolls', 'Chicken Wings']));

      const spring = menu.items.find((i) => i.name === 'Spring Rolls');
      expect(spring?.currency).toBe('USD');
      expect(spring?.isAvailable).toBe(true);
      expect(spring?.imageUrl).toBeDefined();

      const wings = menu.items.find((i) => i.name === 'Chicken Wings');
      expect(wings?.currency).toBe('USD');
      expect(wings?.isAvailable).toBe(true);
      // In the current implementation, Chicken Wings has no imageUrl
      expect(wings?.imageUrl).toBeUndefined();
    });
  });

  describe('updateMenu', () => {
    it('When updating Then increments version and sets lastUpdated ISO string', async () => {
      const existing = buildMenu({ version: 5, restaurantId: 'rid-1' });

      const promise = service.updateMenu(existing.restaurantId, existing);
      await jest.runAllTimersAsync();
      const updated = await promise;

      expect(updated.version).toBe(6);
      // lastUpdated is not part of MenuModel type, but implementation adds it
      expect((updated as unknown as { lastUpdated?: string }).lastUpdated).toMatch(
        /\d{4}-\d{2}-\d{2}T.*/,
      );
    });
  });

  describe('isPopularRestaurant', () => {
    it('When ID is in popular list Then returns true', async () => {
      const promise = service.isPopularRestaurant('123');
      await jest.runAllTimersAsync();
      await expect(promise).resolves.toBe(true);
    });

    it('When ID is not in popular list Then returns false', async () => {
      const promise = service.isPopularRestaurant('not-popular');
      await jest.runAllTimersAsync();
      await expect(promise).resolves.toBe(false);
    });
  });

  describe('getPopularRestaurantMenus', () => {
    it('When called Then returns menus for all popular restaurants', async () => {
      const promise = service.getPopularRestaurantMenus();
      await jest.runAllTimersAsync();
      const menus = await promise;

      expect(Array.isArray(menus)).toBe(true);
      expect(menus.length).toBe(3);
      const ids = menus.map((m) => m.restaurantId);
      expect(ids).toEqual(['123', '456', '789']);

      // Each menu should have items as created by getMenu()
      for (const m of menus) {
        expect(m.items.length).toBeGreaterThan(0);
      }
    });
  });
});
