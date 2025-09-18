import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { QueryPerformanceService } from '../../common/services/query-performance.service';
import { ReadReplicaService } from '../../common/services/read-replica.service';
import { ConnectionPoolService } from '../../common/services/connection-pool.service';
import { IndexOptimizationService } from '../../common/services/index-optimization.service';
import { WebSocketOptimizationService } from '../../common/services/websocket-optimization.service';
import { JobOptimizationService } from '../../common/services/job-optimization.service';
import { ResponseSerializationInterceptor } from '../../common/interceptors/response-serialization.interceptor';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

/**
 * Global module for performance optimization across the application
 */
@Global()
@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [
    PerformanceController,
  ],
  providers: [
    PerformanceService,
    QueryPerformanceService,
    ReadReplicaService,
    ConnectionPoolService,
    IndexOptimizationService,
    WebSocketOptimizationService,
    JobOptimizationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseSerializationInterceptor,
    },
  ],
  exports: [
    PerformanceService,
    QueryPerformanceService,
    ReadReplicaService,
    ConnectionPoolService,
    IndexOptimizationService,
    WebSocketOptimizationService,
    JobOptimizationService,
  ],
})
export class PerformanceModule {}
