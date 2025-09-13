import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { OrderEntity } from '../entities/order.entity';
import { OrderItemEntity } from '../entities/order-item.entity';
import { OrderHistoryEntity } from '../entities/order-history.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderStatus } from '../constants/order-status.enum';
import { PaymentStatus } from '../constants/payment-status.enum';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { TransactionService } from '../services/transaction.service';
import { DatabaseConnectionService } from '../services/database-connection.service';
import { ShardingService } from '../services/sharding.service';

/**
 * Repository for order-related database operations
 */
@Injectable()
export class OrdersRepository {
  private readonly logger = new Logger(OrdersRepository.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    
    @InjectRepository(OrderHistoryEntity)
    private readonly orderHistoryRepository: Repository<OrderHistoryEntity>,
    
    private readonly databaseConnectionService: DatabaseConnectionService,
    
    @Inject('CONNECTION_POOL_SIZE')
    private readonly connectionPoolSize: number,

    private readonly transactionService: TransactionService,
    
    private readonly shardingService: ShardingService
  ) {
    // Log the connection pool size
    const poolSize = this.databaseConnectionService.getPoolSize();
    this.logger.log(`Order database connection pool size: ${poolSize}`);
    
    // Log the shard count
    const shardCount = this.shardingService.getShardCount();
    this.logger.log(`Order database shard count: ${shardCount}`);
  }

  /**
   * Create a new order with transaction isolation
   */
  async createOrder(userId: string, createOrderDto: CreateOrderDto): Promise<OrderEntity> {
    // Generate transaction ID if not provided
    const transactionId = createOrderDto.transactionId || this.transactionService.generateTransactionId();
    
    // Calculate order totals
    const subtotalCents = createOrderDto.items.reduce(
      (sum, item) => sum + (item.unitPriceCents * item.quantity), 
      0
    );
    
    // Apply tax (assuming 10% tax rate)
    const taxCents = Math.round(subtotalCents * 0.1);
    
    // Apply delivery fee (assuming $2.99 delivery fee)
    const deliveryFeeCents = 299;
    
    // Calculate total
    const totalCents = subtotalCents + taxCents + deliveryFeeCents;
    
    // Generate order ID and calculate shard key using the sharding service
    // We'll use this ID later when creating the order
    const { orderId: generatedOrderId, shardKey } = this.shardingService.generateOrderId();
    
    // Use transaction service with retry logic for serialization failures
    return this.transactionService.executeWithRetry(async () => {
      // Get the data source from the database connection service
      const dataSource = this.databaseConnectionService.getDataSource();
      
      return this.transactionService.executeInTransaction(async (manager) => {
        // Check for existing transaction to ensure idempotency
        const existingTransaction = await this.checkTransactionIdempotency(
          transactionId, 
          createOrderDto,
          manager
        );
        
        if (existingTransaction) {
          this.logger.log(`Found existing order with transaction ID ${transactionId}`);
          return existingTransaction;
        }
        
        this.logger.log(`Creating new order with transaction ID ${transactionId}`);
        
        // Create new order with the generated order ID and shard key
        const order = manager.create(OrderEntity, {
          id: generatedOrderId, // Use the generated order ID
          userId,
          restaurantId: createOrderDto.restaurantId,
          transactionId,
          status: OrderStatus.CREATED,
          paymentStatus: PaymentStatus.PENDING,
          subtotalCents,
          taxCents,
          deliveryFeeCents,
          tipCents: 0,
          totalCents,
          currency: createOrderDto.currency || 'USD',
          deliveryAddress: createOrderDto.deliveryAddress,
          deliveryInstructions: createOrderDto.deliveryInstructions,
          shardKey // Use the calculated shard key
        });
        
        // Save order
        const savedOrder = await manager.save(order);
        
        // Create and save order items
        const orderItems = createOrderDto.items.map(item => {
          return manager.create(OrderItemEntity, {
            orderId: savedOrder.id,
            menuItemId: item.menuItemId,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            totalPriceCents: item.quantity * item.unitPriceCents,
            currency: createOrderDto.currency || 'USD',
            customizations: item.customizations
          });
        });
        
        await manager.save(orderItems);
        
        // Create order history entry
        const orderHistory = manager.create(OrderHistoryEntity, {
          orderId: savedOrder.id,
          status: OrderStatus.CREATED,
          note: 'Order created'
        });
        
        await manager.save(orderHistory);
        
        // Return order with items
        const result = await this.findOrderById(savedOrder.id);
        if (!result) {
          throw new Error(`Failed to find created order with ID ${savedOrder.id}`);
        }
        return result;
      });
    });
  }

  /**
   * Check if a transaction ID already exists to ensure idempotency
   */
  private async checkTransactionIdempotency(
    transactionId: string, 
    createOrderDto: CreateOrderDto,
    manager: EntityManager
  ): Promise<OrderEntity | null> {
    const existingOrder = await manager.findOne(OrderEntity, {
      where: { transactionId }
    });
    
    return existingOrder;
  }

  /**
   * Find an order by ID with its items
   */
  async findOrderById(id: string): Promise<OrderEntity> {
    return this.orderRepository.findOne({
      where: { id },
      relations: ['items']
    });
  }

  /**
   * Find orders by user ID
   */
  async findOrdersByUserId(userId: string, limit = 10, offset = 0): Promise<[OrderEntity[], number]> {
    return this.orderRepository.findAndCount({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Find orders by restaurant ID
   */
  async findOrdersByRestaurantId(restaurantId: string, limit = 10, offset = 0): Promise<[OrderEntity[], number]> {
    return this.orderRepository.findAndCount({
      where: { restaurantId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Update order status with transaction isolation
   */
  async updateOrderStatus(
    orderId: string, 
    updateOrderStatusDto: UpdateOrderStatusDto,
    actorId?: string,
    actorType?: string
  ): Promise<OrderEntity> {
    return this.transactionService.executeWithRetry(async () => {
      // Get the data source from the database connection service
      const dataSource = this.databaseConnectionService.getDataSource();
      
      return this.transactionService.executeInTransaction(async (manager) => {
        this.logger.log(`Updating order ${orderId} status to ${updateOrderStatusDto.status}`);
        
        // Update order status
        await manager.update(OrderEntity, orderId, {
          status: updateOrderStatusDto.status,
          updatedAt: new Date()
        });
        
        // Create order history entry
        const orderHistory = manager.create(OrderHistoryEntity, {
          orderId,
          status: updateOrderStatusDto.status,
          note: updateOrderStatusDto.note,
          actorId,
          actorType
        });
        
        await manager.save(orderHistory);
        
        // Return updated order
        const result = await this.findOrderById(orderId);
        if (!result) {
          throw new Error(`Failed to find updated order with ID ${orderId}`);
        }
        return result;
      });
    });
  }

  /**
   * Get order history
   */
  async getOrderHistory(orderId: string): Promise<OrderHistoryEntity[]> {
    return this.orderHistoryRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' }
    });
  }
}
