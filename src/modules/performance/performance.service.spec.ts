import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PerformanceService } from './performance.service';
import { QueryPerformanceService } from '../../common/services/query-performance.service';
import { ReadReplicaService } from '../../common/services/read-replica.service';
import { ConnectionPoolService } from '../../common/services/connection-pool.service';
import { IndexOptimizationService } from '../../common/services/index-optimization.service';
import { WebSocketOptimizationService } from '../../common/services/websocket-optimization.service';
import { JobOptimizationService } from '../../common/services/job-optimization.service';

describe('PerformanceService', () => {
  let service: PerformanceService;
  let configService: jest.Mocked<ConfigService>;
  let queryPerformanceService: jest.Mocked<QueryPerformanceService>;
  let readReplicaService: jest.Mocked<ReadReplicaService>;
  let connectionPoolService: jest.Mocked<ConnectionPoolService>;
  let indexOptimizationService: jest.Mocked<IndexOptimizationService>;
  let webSocketOptimizationService: jest.Mocked<WebSocketOptimizationService>;
  let jobOptimizationService: jest.Mocked<JobOptimizationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: QueryPerformanceService,
          useValue: {},
        },
        {
          provide: ReadReplicaService,
          useValue: {
            getReadReplicaCount: jest.fn(),
          },
        },
        {
          provide: ConnectionPoolService,
          useValue: {
            getActiveConnections: jest.fn(),
            getPoolSize: jest.fn(),
          },
        },
        {
          provide: IndexOptimizationService,
          useValue: {},
        },
        {
          provide: WebSocketOptimizationService,
          useValue: {},
        },
        {
          provide: JobOptimizationService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PerformanceService>(PerformanceService);
    configService = module.get(ConfigService);
    queryPerformanceService = module.get(QueryPerformanceService);
    readReplicaService = module.get(ReadReplicaService);
    connectionPoolService = module.get(ConnectionPoolService);
    indexOptimizationService = module.get(IndexOptimizationService);
    webSocketOptimizationService = module.get(WebSocketOptimizationService);
    jobOptimizationService = module.get(JobOptimizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.stopPerformanceMonitoring(); // Clean up any intervals
  });

  describe('When initializing the module', () => {
    it('Then should start performance monitoring if enabled', async () => {
      configService.get.mockReturnValueOnce(true).mockReturnValueOnce(300000);

      await service.onModuleInit();

      expect(configService.get).toHaveBeenCalledWith('ENABLE_PERFORMANCE_MONITORING', true);
      expect(configService.get).toHaveBeenCalledWith('PERFORMANCE_MONITORING_INTERVAL_MS', 300000);
      // Check if interval is set (private property, access via any)
      expect((service as any).performanceMonitoringInterval).toBeDefined();
    });

    it('Then should not start performance monitoring if disabled', async () => {
      configService.get.mockReturnValueOnce(false);

      await service.onModuleInit();

      expect(configService.get).toHaveBeenCalledWith('ENABLE_PERFORMANCE_MONITORING', true);
      expect((service as any).performanceMonitoringInterval).toBeNull();
    });
  });

  describe('When stopping performance monitoring', () => {
    it('Then should clear the interval if it exists', () => {
      (service as any).performanceMonitoringInterval = setInterval(() => {}, 1000);

      service.stopPerformanceMonitoring();

      expect((service as any).performanceMonitoringInterval).toBeNull();
    });

    it('Then should do nothing if no interval exists', () => {
      (service as any).performanceMonitoringInterval = null;

      service.stopPerformanceMonitoring();

      expect((service as any).performanceMonitoringInterval).toBeNull();
    });
  });

  describe('When getting system health metrics', () => {
    it('Then should return formatted metrics', async () => {
      connectionPoolService.getActiveConnections.mockResolvedValue(5);
      connectionPoolService.getPoolSize.mockReturnValue(10);
      readReplicaService.getReadReplicaCount.mockReturnValue(3);

      const result = await service.getSystemHealthMetrics();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('database');
      expect(result.database).toEqual({
        activeConnections: 5,
        poolSize: 10,
        readReplicaCount: 3,
        connectionUtilization: 50,
      });
      expect(result).toHaveProperty('memory');
      expect(result.memory).toHaveProperty('rss');
      expect(result.memory).toHaveProperty('heapUtilization');
      expect(result).toHaveProperty('cpu');
      expect(result.cpu).toHaveProperty('user');
      expect(result.cpu).toHaveProperty('system');
      expect(result).toHaveProperty('uptime');
    });

    it('Then should throw error if database metrics fail', async () => {
      connectionPoolService.getActiveConnections.mockRejectedValue(new Error('DB error'));

      await expect(service.getSystemHealthMetrics()).rejects.toThrow('DB error');
    });
  });

  describe('When formatting bytes', () => {
    it('Then should format zero bytes', () => {
      const result = (service as any).formatBytes(0);
      expect(result).toBe('0 Bytes');
    });

    it('Then should format bytes correctly', () => {
      expect((service as any).formatBytes(1024)).toBe('1 KB');
      expect((service as any).formatBytes(1048576)).toBe('1 MB');
    });
  });
});
