import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { HealthController } from '../src/modules/health/health.controller';
import { HealthService } from '../src/modules/health/health.service';

describe('When HealthController is invoked', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService]
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('Then it should return liveness payload', () => {
    const res = controller.getLiveness();
    expect(res.status).toBe('ok');
    expect(typeof res.uptime).toBe('number');
    expect(typeof res.timestamp).toBe('string');
  });
});
