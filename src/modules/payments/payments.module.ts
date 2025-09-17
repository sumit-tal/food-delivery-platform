import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentGateway } from './gateways/mock-payment.gateway';
import { CircuitBreakerPaymentGateway } from './gateways/circuit-breaker-payment.gateway';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { PaymentRetryService } from './services/payment-retry.service';
import { PaymentCacheService } from './services/payment-cache.service';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentFailureQueueEntity } from './entities/payment-failure-queue.entity';
import { OrdersModule } from '../orders/orders.module';
import { ResilienceModule } from '../../common/resilience/resilience.module';
import { PaymentGateway } from './interfaces/payment-gateway.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, PaymentFailureQueueEntity]),
    ConfigModule,
    OrdersModule,
    ResilienceModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    CircuitBreakerService,
    PaymentRetryService,
    PaymentCacheService,
    {
      provide: 'BasePaymentGateway',
      useClass: MockPaymentGateway,
    },
    {
      provide: 'PaymentGateway',
      useFactory: (baseGateway: PaymentGateway, circuitBreaker: CircuitBreakerService): PaymentGateway => {
        return new CircuitBreakerPaymentGateway(baseGateway, circuitBreaker);
      },
      inject: ['BasePaymentGateway', CircuitBreakerService],
    },
  ],
  exports: [PaymentsService, CircuitBreakerService, PaymentRetryService, 'PaymentGateway'],
})
export class PaymentsModule {}
