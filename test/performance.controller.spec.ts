import { Test, type TestingModule } from '@nestjs/testing';
import { PerformanceController } from 'src/modules/performance/performance.controller';
import { PerformanceService } from 'src/modules/performance/performance.service';
import { IndexOptimizationService } from 'src/common/services/index-optimization.service';

type PerformanceServiceMock = Pick<PerformanceService, 'getSystemHealthMetrics'>;

type IndexOptimizationServiceMock = Pick<IndexOptimizationService, 'analyzeIndexUsage'>;

describe('PerformanceController - getSystemHealthMetrics', () => {
  let controller: PerformanceController;
  let performanceService: PerformanceServiceMock;

  beforeEach(async () => {
    const mockPerformanceService: PerformanceServiceMock = {
      getSystemHealthMetrics: jest.fn(),
    };

    const mockIndexOptimizationService: IndexOptimizationServiceMock = {
      analyzeIndexUsage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceController],
      providers: [
        { provide: PerformanceService, useValue: mockPerformanceService },
        { provide: IndexOptimizationService, useValue: mockIndexOptimizationService },
      ],
    }).compile();

    controller = module.get<PerformanceController>(PerformanceController);
    performanceService = module.get<PerformanceService>(PerformanceService);
  });

  it('Then it should return system health metrics from the service', async () => {
    const mockMetrics: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      database: { activeConnections: 5, poolSize: 10 },
      memory: { heapUsed: 1000000, heapTotal: 2000000 },
      cpu: { user: 1000, system: 500 },
      uptime: 3600,
    };

    jest.spyOn(performanceService, 'getSystemHealthMetrics').mockResolvedValue(mockMetrics);

    const result = await controller.getSystemHealthMetrics();

    expect(result).toEqual(mockMetrics);
    expect(performanceService.getSystemHealthMetrics).toHaveBeenCalledTimes(1);
  });

  it('Then it should handle service errors gracefully', async () => {
    const error = new Error('Database connection failed');
    jest.spyOn(performanceService, 'getSystemHealthMetrics').mockRejectedValue(error);

    await expect(controller.getSystemHealthMetrics()).rejects.toThrow('Database connection failed');
    expect(performanceService.getSystemHealthMetrics).toHaveBeenCalledTimes(1);
  });
});

describe('PerformanceController - analyzeIndexes', () => {
  let controller: PerformanceController;
  let indexOptimizationService: IndexOptimizationServiceMock;

  beforeEach(async () => {
    const mockPerformanceService: PerformanceServiceMock = {
      getSystemHealthMetrics: jest.fn(),
    };

    const mockIndexOptimizationService: IndexOptimizationServiceMock = {
      analyzeIndexUsage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceController],
      providers: [
        { provide: PerformanceService, useValue: mockPerformanceService },
        { provide: IndexOptimizationService, useValue: mockIndexOptimizationService },
      ],
    }).compile();

    controller = module.get<PerformanceController>(PerformanceController);
    indexOptimizationService = module.get<IndexOptimizationService>(IndexOptimizationService);
  });

  it('Then it should call analyzeIndexUsage and return success message', async () => {
    jest.spyOn(indexOptimizationService, 'analyzeIndexUsage').mockResolvedValue();

    const result = await controller.analyzeIndexes();

    expect(result).toEqual({ message: 'Index analysis completed successfully' });
    expect(indexOptimizationService.analyzeIndexUsage).toHaveBeenCalledTimes(1);
  });

  it('Then it should handle analysis errors gracefully', async () => {
    const error = new Error('Index analysis failed');
    jest.spyOn(indexOptimizationService, 'analyzeIndexUsage').mockRejectedValue(error);

    await expect(controller.analyzeIndexes()).rejects.toThrow('Index analysis failed');
    expect(indexOptimizationService.analyzeIndexUsage).toHaveBeenCalledTimes(1);
  });
});
