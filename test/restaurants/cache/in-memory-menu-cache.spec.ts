import { InMemoryMenuCache } from 'src/modules/restaurants/cache/in-memory-menu-cache';
import type { MenuModel, MenuItemModel } from 'src/modules/restaurants/models/menu.model';

// Helper builders for test data
const buildMenuItem = (overrides: Partial<MenuItemModel> = {}): MenuItemModel => ({
  id: overrides.id ?? 'item-1',
  restaurantId: overrides.restaurantId ?? 'restaurant-1',
  name: overrides.name ?? 'Test Item',
  description: overrides.description ?? 'Test Description',
  priceCents: overrides.priceCents ?? 1000,
  currency: overrides.currency ?? 'USD',
  isAvailable: overrides.isAvailable ?? true,
  tags: overrides.tags ?? [],
  imageUrl: overrides.imageUrl ?? 'https://example.com/image.jpg',
});

const buildMenu = (overrides: Partial<MenuModel> = {}): MenuModel => ({
  restaurantId: overrides.restaurantId ?? 'restaurant-1',
  version: overrides.version ?? 1,
  items: overrides.items ?? [buildMenuItem()],
});

describe('InMemoryMenuCache', () => {
  let cache: InMemoryMenuCache;

  beforeEach(() => {
    cache = new InMemoryMenuCache();
  });

  describe('getLatest', () => {
    it('When restaurant has no cached menu Then returns null', async () => {
      // Given
      const restaurantId = 'restaurant-1';

      // When
      const result = await cache.getLatest(restaurantId);

      // Then
      expect(result).toBeNull();
    });

    it('When restaurant has cached menu Then returns the menu', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const menu = buildMenu({ restaurantId, version: 1 });
      await cache.set(menu);

      // When
      const result = await cache.getLatest(restaurantId);

      // Then
      expect(result).toEqual(menu);
    });

    it('When requesting different restaurant Then returns null', async () => {
      // Given
      const restaurantId1 = 'restaurant-1';
      const restaurantId2 = 'restaurant-2';
      const menu = buildMenu({ restaurantId: restaurantId1, version: 1 });
      await cache.set(menu);

      // When
      const result = await cache.getLatest(restaurantId2);

      // Then
      expect(result).toBeNull();
    });

    it('When menu is invalidated Then returns null', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const menu = buildMenu({ restaurantId, version: 1 });
      await cache.set(menu);
      await cache.invalidate(restaurantId);

      // When
      const result = await cache.getLatest(restaurantId);

      // Then
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('When setting new menu Then stores the menu', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const menu = buildMenu({ restaurantId, version: 1 });

      // When
      await cache.set(menu);

      // Then
      const result = await cache.getLatest(restaurantId);
      expect(result).toEqual(menu);
    });

    it('When setting menu with higher version Then updates the menu', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const oldMenu = buildMenu({ restaurantId, version: 1 });
      const newMenu = buildMenu({ restaurantId, version: 2 });
      await cache.set(oldMenu);

      // When
      await cache.set(newMenu);

      // Then
      const result = await cache.getLatest(restaurantId);
      expect(result).toEqual(newMenu);
    });

    it('When setting menu with same version Then updates the menu', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const oldMenu = buildMenu({ restaurantId, version: 1 });
      const newMenu = buildMenu({ restaurantId, version: 1, items: [buildMenuItem({ name: 'Updated Item' })] });
      await cache.set(oldMenu);

      // When
      await cache.set(newMenu);

      // Then
      const result = await cache.getLatest(restaurantId);
      expect(result).toEqual(newMenu);
    });

    it('When setting menu with lower version Then ignores the update', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const newMenu = buildMenu({ restaurantId, version: 2 });
      const oldMenu = buildMenu({ restaurantId, version: 1 });
      await cache.set(newMenu);

      // When
      await cache.set(oldMenu);

      // Then
      const result = await cache.getLatest(restaurantId);
      expect(result).toEqual(newMenu);
    });

    it('When setting menu for different restaurant Then stores both menus', async () => {
      // Given
      const restaurantId1 = 'restaurant-1';
      const restaurantId2 = 'restaurant-2';
      const menu1 = buildMenu({ restaurantId: restaurantId1, version: 1 });
      const menu2 = buildMenu({ restaurantId: restaurantId2, version: 1 });

      // When
      await cache.set(menu1);
      await cache.set(menu2);

      // Then
      const result1 = await cache.getLatest(restaurantId1);
      const result2 = await cache.getLatest(restaurantId2);
      expect(result1).toEqual(menu1);
      expect(result2).toEqual(menu2);
    });

    it('When setting menu with complex items Then stores correctly', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const items = [
        buildMenuItem({ id: 'item-1', name: 'Pizza', priceCents: 1500 }),
        buildMenuItem({ id: 'item-2', name: 'Pasta', priceCents: 1200, isAvailable: false }),
      ];
      const menu = buildMenu({ restaurantId, version: 1, items });

      // When
      await cache.set(menu);

      // Then
      const result = await cache.getLatest(restaurantId);
      expect(result?.items).toHaveLength(2);
      expect(result?.items[0].name).toBe('Pizza');
      expect(result?.items[1].isAvailable).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('When invalidating existing menu Then removes the menu', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const menu = buildMenu({ restaurantId, version: 1 });
      await cache.set(menu);

      // When
      await cache.invalidate(restaurantId);

      // Then
      const result = await cache.getLatest(restaurantId);
      expect(result).toBeNull();
    });

    it('When invalidating non-existent restaurant Then does nothing', async () => {
      // Given
      const restaurantId = 'restaurant-1';

      // When
      await cache.invalidate(restaurantId);

      // Then
      const result = await cache.getLatest(restaurantId);
      expect(result).toBeNull();
    });

    it('When invalidating one restaurant Then other restaurants remain', async () => {
      // Given
      const restaurantId1 = 'restaurant-1';
      const restaurantId2 = 'restaurant-2';
      const menu1 = buildMenu({ restaurantId: restaurantId1, version: 1 });
      const menu2 = buildMenu({ restaurantId: restaurantId2, version: 1 });
      await cache.set(menu1);
      await cache.set(menu2);

      // When
      await cache.invalidate(restaurantId1);

      // Then
      const result1 = await cache.getLatest(restaurantId1);
      const result2 = await cache.getLatest(restaurantId2);
      expect(result1).toBeNull();
      expect(result2).toEqual(menu2);
    });
  });

  describe('Integration tests', () => {
    it('When performing multiple operations Then behaves correctly', async () => {
      // Given
      const restaurantId = 'restaurant-1';

      // When & Then - Set initial menu
      const menuV1 = buildMenu({ restaurantId, version: 1 });
      await cache.set(menuV1);
      expect(await cache.getLatest(restaurantId)).toEqual(menuV1);

      // When & Then - Update to higher version
      const menuV2 = buildMenu({ restaurantId, version: 2 });
      await cache.set(menuV2);
      expect(await cache.getLatest(restaurantId)).toEqual(menuV2);

      // When & Then - Try to set lower version (should be ignored)
      const menuV1Again = buildMenu({ restaurantId, version: 1 });
      await cache.set(menuV1Again);
      expect(await cache.getLatest(restaurantId)).toEqual(menuV2);

      // When & Then - Invalidate
      await cache.invalidate(restaurantId);
      expect(await cache.getLatest(restaurantId)).toBeNull();

      // When & Then - Set new menu after invalidation
      const menuV3 = buildMenu({ restaurantId, version: 3 });
      await cache.set(menuV3);
      expect(await cache.getLatest(restaurantId)).toEqual(menuV3);
    });
  });
});
