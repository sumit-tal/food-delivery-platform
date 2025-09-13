import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderHistoryEntity } from './entities/order-history.entity';
import { OrderTransactionEntity } from './entities/order-transaction.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repositories/orders.repository';
import { OrderProcessingService } from './services/order-processing.service';
import { TransactionService } from './services/transaction.service';
import { IdempotencyService } from './services/idempotency.service';
import { DatabaseConnectionService } from './services/database-connection.service';
import { ShardingService } from './services/sharding.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      OrderHistoryEntity,
      OrderTransactionEntity
    ]),
    ConfigModule
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    OrderProcessingService,
    TransactionService,
    IdempotencyService,
    DatabaseConnectionService,
    ShardingService,
    {
      provide: 'CONNECTION_POOL_SIZE',
      useValue: process.env.ORDER_DB_POOL_SIZE || 50
    },
    {
      provide: 'DB_SHARD_COUNT',
      useValue: process.env.DB_SHARD_COUNT || 16
    }
  ],
  exports: [
    OrdersService, 
    OrderProcessingService, 
    TransactionService, 
    IdempotencyService,
    DatabaseConnectionService,
    ShardingService
  ]
})
export class OrdersModule {}
