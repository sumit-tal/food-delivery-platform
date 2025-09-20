jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

import { RedisMenuCache } from 'src/modules/restaurants/cache/redis-menu-cache';
import type { MenuModel, MenuItemModel } from 'src/modules/restaurants/models/menu.model';

// Mock Redis client
interface MockRedisMulti {
  set(key: string, value: string): MockRedisMulti;
  exec(): Promise<unknown>;
}

interface MockRedisClient {
  connect(): Promise<void>;
  quit(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  del(key: string): Promise<number>;
  multi(): MockRedisMulti;
}

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

describe('RedisMenuCache', () => {
  let cache: RedisMenuCache;
  let mockClient: jest.Mocked<MockRedisClient>;
  let mockMulti: jest.Mocked<MockRedisMulti>;

  beforeEach(() => {
    // Create mock multi instance
    mockMulti = {
      set: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock client
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      multi: jest.fn().mockReturnValue(mockMulti),
    };

    // Mock the Redis import
    const redis = require('redis');
    const mockCreateClient = redis.createClient as jest.MockedFunction<typeof redis.createClient>;
    mockCreateClient.mockReturnValue(mockClient);

    cache = new RedisMenuCache('redis://localhost:6379', 'test-prefix');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('When creating with URL and prefix Then stores them correctly', () => {
      // Given
      const url = 'redis://localhost:6379';
      const prefix = 'custom-prefix';

      // When
      const cache = new RedisMenuCache(url, prefix);

      // Then
      expect((cache as any).url).toBe(url);
      expect((cache as any).prefix).toBe(prefix);
    });

    it('When creating without prefix Then uses default prefix', () => {
      // Given
      const url = 'redis://localhost:6379';

      // When
      const cache = new RedisMenuCache(url);

      // Then
      expect((cache as any).prefix).toBe('se');
    });
  });

  describe('connect', () => {
    it('When connecting first time Then creates and connects client', async () => {
      // When
      await cache.connect();

      // Then
      const { createClient } = require('redis');
      expect(createClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
      expect(mockClient.connect).toHaveBeenCalled();
      expect((cache as any).client).toBe(mockClient);
    });

    it('When connecting multiple times Then only connects once', async () => {
      // Given
      (cache as any).client = mockClient;

      // When
      await cache.connect();

      // Then
      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it('When connect fails Then throws error', async () => {
      // Given
      const redis = require('redis');
      const mockCreateClient = redis.createClient as jest.MockedFunction<typeof redis.createClient>;
      mockCreateClient.mockReturnValue(mockClient);
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      // When & Then
      await expect(cache.connect()).rejects.toThrow('Connection failed');
      expect((cache as any).client).toBeNull();
    });
  });

  describe('getLatest', () => {
    beforeEach(async () => {
      (cache as any).client = mockClient;
    });

    it('When restaurant has no cached menu Then returns null', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      mockClient.get.mockResolvedValue(null);

      // When
      const result = await cache.getLatest(restaurantId);

      // Then
      expect(result).toBeNull();
      expect(mockClient.get).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:latest');
    });

    it('When restaurant has cached menu Then returns the menu', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const menu = buildMenu({ restaurantId, version: 5 });
      mockClient.get
        .mockResolvedValueOnce('5') // latest version
        .mockResolvedValueOnce(JSON.stringify(menu)); // menu data

      // When
      const result = await cache.getLatest(restaurantId);

      // Then
      expect(result).toEqual(menu);
      expect(mockClient.get).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:latest');
      expect(mockClient.get).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:v:5');
    });

    it('When version is invalid number Then returns null', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      mockClient.get.mockResolvedValueOnce('invalid-version');

      // When
      const result = await cache.getLatest(restaurantId);

      // Then
      expect(result).toBeNull();
    });

    it('When menu data is invalid JSON Then returns null', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      mockClient.get
        .mockResolvedValueOnce('5') // latest version
        .mockResolvedValueOnce('invalid json'); // invalid menu data

      // When
      const result = await cache.getLatest(restaurantId);

      // Then
      expect(result).toBeNull();
    });

    it('When Redis get fails Then throws error', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      mockClient.get.mockRejectedValue(new Error('Redis get failed'));

      // When & Then
      await expect(cache.getLatest(restaurantId)).rejects.toThrow('Redis get failed');
    });

    it('When requesting different restaurant Then returns different menu', async () => {
      // Given
      const menu1 = buildMenu({ restaurantId: 'restaurant-1', version: 1 });
      const menu2 = buildMenu({ restaurantId: 'restaurant-2', version: 2 });
      mockClient.get.mockImplementation((key: string) => {
        if (key.includes('restaurant-1:latest')) return Promise.resolve('1');
        if (key.includes('restaurant-1:v:1')) return Promise.resolve(JSON.stringify(menu1));
        if (key.includes('restaurant-2:latest')) return Promise.resolve('2');
        if (key.includes('restaurant-2:v:2')) return Promise.resolve(JSON.stringify(menu2));
        return Promise.resolve(null);
      });

      // When
      const result1 = await cache.getLatest('restaurant-1');
      const result2 = await cache.getLatest('restaurant-2');

      // Then
      expect(result1).toEqual(menu1);
      expect(result2).toEqual(menu2);
    });

    it('When no client connected Then connects automatically', async () => {
      // Given
      (cache as any).client = null;
      const restaurantId = 'restaurant-1';
      mockClient.get.mockResolvedValue(null);

      // When
      await cache.getLatest(restaurantId);

      // Then
      expect(mockClient.connect).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      (cache as any).client = mockClient;
    });

    it('When setting new menu Then stores menu and version', async () => {
      // Given
      const menu = buildMenu({ restaurantId: 'restaurant-1', version: 1 });

      // When
      await cache.set(menu);

      // Then
      expect(mockMulti.set).toHaveBeenCalledWith(
        'test-prefix:menu:restaurant-1:v:1',
        JSON.stringify(menu),
      );
      expect(mockMulti.set).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:latest', '1');
      expect(mockMulti.exec).toHaveBeenCalled();
    });

    it('When setting menu with higher version Then updates both keys', async () => {
      // Given
      const menu = buildMenu({ restaurantId: 'restaurant-1', version: 5 });

      // When
      await cache.set(menu);

      // Then
      expect(mockMulti.set).toHaveBeenCalledWith(
        'test-prefix:menu:restaurant-1:v:5',
        JSON.stringify(menu),
      );
      expect(mockMulti.set).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:latest', '5');
      expect(mockMulti.exec).toHaveBeenCalled();
    });

    it('When no client connected Then connects automatically', async () => {
      // Given
      (cache as any).client = null;
      const menu = buildMenu({ restaurantId: 'restaurant-1', version: 1 });

      // When
      await cache.set(menu);

      // Then
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('When Redis operations fail Then throws error', async () => {
      // Given
      const menu = buildMenu({ restaurantId: 'restaurant-1', version: 1 });
      mockMulti.exec.mockRejectedValue(new Error('Redis error'));

      // When & Then
      await expect(cache.set(menu)).rejects.toThrow('Redis error');
    });
  });

  describe('invalidate', () => {
    beforeEach(async () => {
      (cache as any).client = mockClient;
    });

    it('When invalidating existing menu Then deletes latest key', async () => {
      // Given
      const restaurantId = 'restaurant-1';

      // When
      await cache.invalidate(restaurantId);

      // Then
      expect(mockClient.del).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:latest');
    });

    it('When invalidating non-existent restaurant Then still calls delete', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      mockClient.del.mockResolvedValue(0); // Key didn't exist

      // When
      await cache.invalidate(restaurantId);

      // Then
      expect(mockClient.del).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:latest');
    });

    it('When no client connected Then connects automatically', async () => {
      // Given
      (cache as any).client = null;
      const restaurantId = 'restaurant-1';

      // When
      await cache.invalidate(restaurantId);

      // Then
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('When Redis delete fails Then throws error', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      mockClient.del.mockRejectedValue(new Error('Delete failed'));

      // When & Then
      await expect(cache.invalidate(restaurantId)).rejects.toThrow('Delete failed');
    });
  });

  describe('key generation', () => {
    it('keyLatest generates correct key format', () => {
      // Given
      const restaurantId = 'restaurant-123';

      // When
      const key = (cache as any).keyLatest(restaurantId);

      // Then
      expect(key).toBe('test-prefix:menu:restaurant-123:latest');
    });

    it('keyVersion generates correct key format', () => {
      // Given
      const restaurantId = 'restaurant-123';
      const version = 42;

      // When
      const key = (cache as any).keyVersion(restaurantId, version);

      // Then
      expect(key).toBe('test-prefix:menu:restaurant-123:v:42');
    });
  });

  describe('Integration tests', () => {
    beforeEach(async () => {
      (cache as any).client = mockClient;
    });

    it('When performing complete workflow Then behaves correctly', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const menuV1 = buildMenu({ restaurantId, version: 1 });

      // Mock Redis responses
      mockClient.get.mockImplementation((key: string) => {
        if (key === 'test-prefix:menu:restaurant-1:latest') {
          // Return version 1 initially, then null after invalidation
          return mockClient.get.mock.calls.filter((call) => call[0] === key).length > 1
            ? Promise.resolve(null)
            : Promise.resolve('1');
        }
        if (key === 'test-prefix:menu:restaurant-1:v:1') {
          return Promise.resolve(JSON.stringify(menuV1));
        }
        return Promise.resolve(null);
      });

      // When & Then - Set initial menu
      await cache.set(menuV1);
      expect(mockMulti.set).toHaveBeenCalledWith(
        'test-prefix:menu:restaurant-1:v:1',
        JSON.stringify(menuV1),
      );
      expect(mockMulti.set).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:latest', '1');

      // When & Then - Get latest menu
      const retrieved = await cache.getLatest(restaurantId);
      expect(retrieved).toEqual(menuV1);

      // When & Then - Invalidate
      await cache.invalidate(restaurantId);
      expect(mockClient.del).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:latest');

      // When & Then - Get after invalidation
      const afterInvalidate = await cache.getLatest(restaurantId);
      expect(afterInvalidate).toBeNull();
    });

    it('When setting multiple versions Then stores all versions', async () => {
      // Given
      const restaurantId = 'restaurant-1';
      const menuV1 = buildMenu({ restaurantId, version: 1 });
      const menuV2 = buildMenu({ restaurantId, version: 2 });

      // When
      await cache.set(menuV1);
      await cache.set(menuV2);

      // Then
      expect(mockMulti.set).toHaveBeenCalledWith(
        'test-prefix:menu:restaurant-1:v:1',
        JSON.stringify(menuV1),
      );
      expect(mockMulti.set).toHaveBeenCalledWith(
        'test-prefix:menu:restaurant-1:v:2',
        JSON.stringify(menuV2),
      );
      expect(mockMulti.set).toHaveBeenCalledWith('test-prefix:menu:restaurant-1:latest', '2');
    });
  });
});
