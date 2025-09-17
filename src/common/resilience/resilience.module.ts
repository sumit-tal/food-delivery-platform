import { Module, Global } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitBreakerHealthService } from './circuit-breaker-health.service';
import { CircuitBreakerMonitorService } from './circuit-breaker-monitor.service';
import { CircuitBreakerHealthController } from './circuit-breaker-health.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot()
  ],
  controllers: [CircuitBreakerHealthController],
  providers: [
    CircuitBreakerService,
    CircuitBreakerHealthService,
    CircuitBreakerMonitorService
  ],
  exports: [
    CircuitBreakerService,
    CircuitBreakerHealthService,
    CircuitBreakerMonitorService
  ],
})
export class ResilienceModule {}
