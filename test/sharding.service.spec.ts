import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ShardingService } from '../src/modules/orders/services/sharding.service';

describe('When using ShardingService', () => {
  let service: ShardingService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShardingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ShardingService>(ShardingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When initializing the service', () => {
    it('Then should use default shard count if not configured', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(undefined);

      // Act
      const newService = new ShardingService(configService);

      // Assert
      expect(mockConfigService.get).toHaveBeenCalledWith('DB_SHARD_COUNT', 16);
      expect(newService.getShardCount()).toBe(16);
    });

    it('Then should use configured shard count', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(32);

      // Act
      const newService = new ShardingService(configService);

      // Assert
      expect(mockConfigService.get).toHaveBeenCalledWith('DB_SHARD_COUNT', 16);
      expect(newService.getShardCount()).toBe(32);
    });
  });

  describe('When calculating shard key', () => {
    it('Then should return consistent shard key for the same order ID', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(16);
      const orderId = '123e4567-e89b-12d3-a456-426614174000';

      // Act
      const shardKey1 = service.calculateShardKey(orderId);
      const shardKey2 = service.calculateShardKey(orderId);

      // Assert
      expect(shardKey1).toBe(shardKey2);
      expect(shardKey1).toBeGreaterThanOrEqual(0);
      expect(shardKey1).toBeLessThan(16);
    });

    it('Then should distribute shard keys evenly', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(16);
      const orderIds = Array.from({ length: 1000 }, () => {
        const uuid = Array.from({ length: 32 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join('');
        return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(
          16,
          20,
        )}-${uuid.slice(20)}`;
      });

      // Act
      const shardKeys = orderIds.map((id) => service.calculateShardKey(id));
      const distribution = new Map<number, number>();
      shardKeys.forEach((key) => {
        distribution.set(key, (distribution.get(key) || 0) + 1);
      });

      // Assert
      // Check that all shard keys are used
      expect(distribution.size).toBeGreaterThanOrEqual(10); // Should use most of the 16 shards

      // Check that distribution is relatively even (no shard has more than 2x the expected average)
      const average = 1000 / 16;
      const maxCount = Math.max(...distribution.values());
      expect(maxCount).toBeLessThan(average * 2);
    });
  });

  describe('When generating order ID', () => {
    it('Then should generate order ID with random shard key', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(16);

      // Act
      const { orderId, shardKey } = service.generateOrderId();

      // Assert
      expect(orderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(shardKey).toBeGreaterThanOrEqual(0);
      expect(shardKey).toBeLessThan(16);
    });

    it('Then should generate order ID with specific shard key', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(16);
      const targetShardKey = 5;

      // Act
      const { orderId, shardKey } = service.generateOrderId(targetShardKey);

      // Assert
      expect(orderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(shardKey).toBe(targetShardKey);
    });

    it('Then should throw error for invalid shard key', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(16);

      // Act & Assert
      expect(() => service.generateOrderId(16)).toThrow('Invalid shard key');
      expect(() => service.generateOrderId(-1)).toThrow('Invalid shard key');
    });
  });

  describe('When getting shard connection string', () => {
    it('Then should return connection string with shard key', () => {
      // Arrange
      mockConfigService.get.mockImplementation((key, defaultValue) => {
        if (key === 'DB_SHARD_COUNT') return 16;
        if (key === 'DB_CONNECTION_STRING') return 'postgresql://user:pass@localhost:5432/db';
        return defaultValue;
      });

      // Act
      const connectionString = service.getShardConnectionString(5);

      // Assert
      expect(connectionString).toBe('postgresql://user:pass@localhost:5432/db_shard_5');
    });

    it('Then should throw error for invalid shard key', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(16);

      // Act & Assert
      expect(() => service.getShardConnectionString(16)).toThrow('Invalid shard key');
      expect(() => service.getShardConnectionString(-1)).toThrow('Invalid shard key');
    });
  });
});
