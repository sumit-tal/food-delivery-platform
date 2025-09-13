import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { MockPaymentGateway } from './gateways/mock-payment.gateway';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { PaymentRetryService } from './services/payment-retry.service';
import { PaymentCacheService } from './services/payment-cache.service';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentFailureQueueEntity } from './entities/payment-failure-queue.entity';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      PaymentFailureQueueEntity
    ]),
    ConfigModule,
    OrdersModule
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    CircuitBreakerService,
    PaymentRetryService,
    PaymentCacheService,
    {
      provide: 'PaymentGateway',
      useClass: MockPaymentGateway
    }
  ],
  exports: [
    PaymentsService,
    CircuitBreakerService,
    PaymentRetryService,
    'PaymentGateway'
  ]
})
export class PaymentsModule {}
