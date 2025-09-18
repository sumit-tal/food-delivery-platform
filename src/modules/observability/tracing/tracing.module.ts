import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TracingService } from './tracing.service';
import { JaegerTracingService } from './jaeger-tracing.service';

/**
 * TracingModule provides functionality for distributed tracing.
 * It includes services for trace collection and shipping to Jaeger.
 */
@Module({
  imports: [ConfigModule],
  providers: [TracingService, JaegerTracingService],
  exports: [TracingService, JaegerTracingService],
})
export class TracingModule {}
