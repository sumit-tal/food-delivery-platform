import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * HealthModule bundles health endpoints and logic.
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService]
})
export class HealthModule {}
