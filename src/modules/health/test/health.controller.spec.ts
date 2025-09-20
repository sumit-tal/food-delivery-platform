import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { HealthController } from '../health.controller';
import { HealthService } from '../health.service';

describe('When HealthController is invoked', () => {
  let controller: HealthController;
  let healthService: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService]
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
  });

  describe('When getLiveness is called', () => {
    it('Then it should return liveness payload with correct structure', () => {
      const result = controller.getLiveness();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.status).toBe('string');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });

    it('Then it should return status as "ok"', () => {
      const result = controller.getLiveness();

      expect(result.status).toBe('ok');
    });

    it('Then it should return a valid uptime value', () => {
      const result = controller.getLiveness();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('Then it should return a valid ISO timestamp', () => {
      const result = controller.getLiveness();

      // Check if timestamp is a valid ISO string
      const timestamp = new Date(result.timestamp);
      expect(timestamp.toISOString()).toBe(result.timestamp);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('When healthService.getLiveness is called internally', () => {
    it('Then it should delegate to healthService', () => {
      const spy = jest.spyOn(healthService, 'getLiveness');

      controller.getLiveness();

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
