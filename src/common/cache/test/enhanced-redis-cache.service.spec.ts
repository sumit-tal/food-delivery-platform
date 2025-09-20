import type { EventEmitter2 } from '@nestjs/event-emitter';
import { EnhancedRedisCache } from '../enhanced-redis-cache.service';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  quit: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  exists: jest.fn(),
  scan: jest.fn(),
  ttl: jest.fn(),
  sAdd: jest.fn(),
  sMembers: jest.fn(),
  sRem: jest.fn(),
  keys: jest.fn(),
  multi: jest.fn(),
  on: jest.fn(),
  isOpen: true,
};

// Silence background refresh intervals created by the service during tests
beforeAll(() => {
  jest
    .spyOn(global, 'setInterval')
    .mockImplementation((() => 0 as unknown as NodeJS.Timer) as unknown as typeof setInterval);
});

afterAll(() => {
  (global.setInterval as unknown as jest.SpyInstance).mockRestore();
});

// Mock createClient
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

// Mock EventEmitter2
const mockEventEmitter = {
  on: jest.fn(),
  emit: jest.fn(),
};

describe('When EnhancedRedisCache is used', () => {
  let service: EnhancedRedisCache;
  let redisUrl: string;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    redisUrl = 'redis://localhost:6379';
    eventEmitter = mockEventEmitter as unknown as EventEmitter2;

    service = new EnhancedRedisCache(redisUrl, eventEmitter, 'test');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When constructor is called', () => {
    it('Then it should initialize with default values', () => {
      expect(service).toBeDefined();
    });

    it('Then it should setup event listeners', () => {
      expect(mockEventEmitter.on).toHaveBeenCalledWith('cache.invalidate', expect.any(Function));
    });
  });

  describe('When connect is called', () => {
    it('Then it should connect to Redis successfully', async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);

      await service.connect();

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('Then it should not reconnect if already connected', async () => {
      // Simulate already connected
      (service as any).client = mockRedisClient;

      await service.connect();

      expect(mockRedisClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('When get is called', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();
    });

    it('Then it should return cached value when key exists', async () => {
      const testKey = 'testKey';
      const testValue = { data: 'test' };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(testValue));

      const result = await service.get(testKey);

      expect(result).toEqual(testValue);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test:testKey');
    });

    it('Then it should return null when key does not exist', async () => {
      const testKey = 'nonExistentKey';
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.get(testKey);

      expect(result).toBeNull();
    });
  });

  describe('When set is called', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();
    });

    it('Then it should store value in cache with default TTL', async () => {
      const testKey = 'testKey';
      const testValue = 'testValue';

      await service.set(testKey, testValue);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:testKey',
        3600, // default TTL
        testValue, // String values are not JSON stringified
      );
    });

    it('Then it should store value with custom TTL', async () => {
      const testKey = 'testKey';
      const testValue = 'testValue';
      const customTtl = 1800;

      await service.set(testKey, testValue, { ttl: customTtl });

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:testKey',
        customTtl,
        testValue, // String values are not JSON stringified
      );
    });

    it('Then it should emit cache.set event', async () => {
      const testKey = 'testKey';
      const testValue = 'testValue';

      await service.set(testKey, testValue);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('cache.set', {
        key: testKey,
        ttl: 3600,
      });
    });
  });

  describe('When delete is called', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();
    });

    it('Then it should delete key and return true when key exists', async () => {
      const testKey = 'testKey';
      // Ensure all DEL calls within this test resolve to success (covers tag set DEL and key DEL)
      mockRedisClient.sMembers.mockResolvedValueOnce([]); // No tags
      mockRedisClient.del.mockImplementation((...keys: string[]) => keys.length);

      const result = await service.delete(testKey);

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:testKey');
    });

    it('Then it should return false when key does not exist', async () => {
      const testKey = 'nonExistentKey';
      // Ensure no tags and override any prior mockImplementation on DEL
      mockRedisClient.sMembers.mockResolvedValueOnce([]);
      mockRedisClient.del.mockReset();
      // First DEL for key's tags set, second DEL for actual key
      mockRedisClient.del.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const result = await service.delete(testKey);

      expect(result).toBe(false);
    });

    it('Then it should emit cache.delete event', async () => {
      const testKey = 'testKey';
      mockRedisClient.del.mockResolvedValueOnce(1);

      await service.delete(testKey);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('cache.delete', {
        key: testKey,
      });
    });
  });

  describe('When has is called', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();
    });

    it('Then it should return true when key exists', async () => {
      const testKey = 'testKey';
      mockRedisClient.exists.mockResolvedValueOnce(1);

      const result = await service.has(testKey);

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test:testKey');
    });

    it('Then it should return false when key does not exist', async () => {
      const testKey = 'nonExistentKey';
      mockRedisClient.exists.mockResolvedValueOnce(0);

      const result = await service.has(testKey);

      expect(result).toBe(false);
    });
  });

  describe('When getOrSet is called', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();
    });

    it('Then it should return cached value when key exists', async () => {
      const testKey = 'testKey';
      const testValue = { data: 'cached' };
      const factory = jest.fn();

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(testValue));

      const result = await service.getOrSet(testKey, factory);

      expect(result).toEqual(testValue);
      expect(factory).not.toHaveBeenCalled();
    });

    it('Then it should call factory and cache result when key does not exist', async () => {
      const testKey = 'testKey';
      const testValue = { data: 'generated' };
      const factory = jest.fn().mockResolvedValue(testValue);

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.set.mockResolvedValueOnce('OK');

      const result = await service.getOrSet(testKey, factory);

      expect(result).toEqual(testValue);
      expect(factory).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:testKey',
        3600,
        JSON.stringify(testValue),
      );
    });
  });

  describe('When clear is called', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();
    });

    it('Then it should clear all cache entries', async () => {
      mockRedisClient.scan
        .mockResolvedValueOnce({ cursor: 0, keys: ['test:key1', 'test:key2'] })
        .mockResolvedValueOnce({ cursor: 0, keys: [] });
      mockRedisClient.del.mockResolvedValueOnce(2);

      await service.clear();

      expect(mockRedisClient.del).toHaveBeenCalledWith('test:key1', 'test:key2');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('cache.clear', {});
    });
  });

  describe('When getStats is called', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();
    });

    it('Then it should return cache statistics', () => {
      mockRedisClient.scan.mockResolvedValue({ cursor: 0, keys: [] });

      const stats = service.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRatio');
      expect(stats).toHaveProperty('avgGetTime');
      expect(stats).toHaveProperty('avgSetTime');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('timestamp');
    });
  });

  describe('When tags are used', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();
    });

    it('Then it should associate key with tags during set', async () => {
      const testKey = 'testKey';
      const testValue = 'testValue';
      const tags = ['tag1', 'tag2'];

      await service.set(testKey, testValue, { tags });

      expect(mockRedisClient.sAdd).toHaveBeenCalledWith('test:tag:tag1', testKey);
      expect(mockRedisClient.sAdd).toHaveBeenCalledWith('test:tag:tag2', testKey);
      expect(mockRedisClient.sAdd).toHaveBeenCalledWith('test:key:testKey:tags', ...tags);
    });

    it('Then it should delete keys by tags', async () => {
      const tags = ['tag1'];
      mockRedisClient.sMembers.mockResolvedValueOnce(['key1', 'key2']);
      mockRedisClient.del.mockResolvedValueOnce(1);

      await service.deleteByTags(tags);

      expect(mockRedisClient.sMembers).toHaveBeenCalledWith('test:tag:tag1');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('cache.deleteByTags', { tags });
    });
  });

  describe('When background refresh is enabled', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();
    });

    it('Then it should store refresh factory in queue', async () => {
      const testKey = 'testKey';
      const testValue = 'testValue';
      const refreshFactory = jest.fn().mockResolvedValue('refreshed');

      await service.set(testKey, testValue, {
        backgroundRefresh: true,
        refreshFactory,
      });

      const queue = (service as any).backgroundRefreshQueue;
      expect(queue.has(testKey)).toBe(true);
    });
  });

  describe('When staggered expiration is used', () => {
    it('Then it should apply jitter to TTL', async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();

      const testKey = 'testKey';
      const testValue = 'testValue';
      const baseTtl = 1000;

      // Mock Math.random to return 0.5 for consistent testing
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5);

      await service.set(testKey, testValue, {
        ttl: baseTtl,
        useStaggeredExpiration: true,
      });

      // Expected staggered TTL: min + random * (max - min)
      // min = 1000 - 150 = 850, max = 1000 + 150 = 1150
      // With random = 0.5: 850 + 0.5 * (1150 - 850) = 1000
      const expectedTtl = 1000;

      expect(mockRedisClient.setEx).toHaveBeenCalledWith('test:testKey', expectedTtl, testValue);

      // Restore original Math.random
      Math.random = originalRandom;
    });
  });

  describe('When errors occur', () => {
    it('Then get should return null on Redis error', async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();

      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await service.get('testKey');

      expect(result).toBeNull();
    });

    it('Then set should handle Redis errors gracefully', async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      await service.connect();

      mockRedisClient.setEx.mockRejectedValueOnce(new Error('Redis connection failed'));

      await expect(service.set('testKey', 'testValue')).resolves.not.toThrow();
    });
  });
});
