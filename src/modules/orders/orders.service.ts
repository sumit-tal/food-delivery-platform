import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderEntity } from './entities/order.entity';
import { OrderHistoryEntity } from './entities/order-history.entity';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from './constants/order-status.enum';
import { IdempotencyService } from './services/idempotency.service';
import { TransactionService } from './services/transaction.service';

/**
 * Service for order-related business logic
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly idempotencyService: IdempotencyService,
    private readonly transactionService: TransactionService
  ) {}

  /**
   * Create a new order
   */
  async createOrder(userId: string, createOrderDto: CreateOrderDto): Promise<OrderEntity> {
    try {
      // Generate transaction ID if not provided for idempotency
      const transactionId = createOrderDto.transactionId || this.transactionService.generateTransactionId();
      
      // Create a copy of the DTO with the transaction ID
      const orderData = { 
        ...createOrderDto,
        transactionId 
      };
      
      this.logger.log(`Creating order with transaction ID ${transactionId}`);
      
      // Use idempotency service to ensure the operation is idempotent
      return await this.idempotencyService.executeWithIdempotency(
        transactionId,
        { userId, orderData },
        async () => {
          return this.ordersRepository.createOrder(userId, orderData);
        }
      );
    } catch (error: unknown) {
      // Handle specific errors
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new BadRequestException('Duplicate order transaction ID');
      }
      
      // Re-throw other errors
      if (error instanceof Error) {
        this.logger.error(`Error creating order: ${error.message}`);
      } else {
        this.logger.error('Unknown error creating order');
      }
      
      throw error;
    }
  }

  /**
   * Get an order by ID
   */
  async getOrderById(id: string): Promise<OrderEntity> {
    const order = await this.ordersRepository.findOrderById(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  /**
   * Get orders by user ID
   */
  async getOrdersByUserId(userId: string, page = 1, limit = 10): Promise<{ orders: OrderEntity[]; total: number }> {
    const offset = (page - 1) * limit;
    const [orders, total] = await this.ordersRepository.findOrdersByUserId(userId, limit, offset);
    return { orders, total };
  }

  /**
   * Get orders by restaurant ID
   */
  async getOrdersByRestaurantId(restaurantId: string, page = 1, limit = 10): Promise<{ orders: OrderEntity[]; total: number }> {
    const offset = (page - 1) * limit;
    const [orders, total] = await this.ordersRepository.findOrdersByRestaurantId(restaurantId, limit, offset);
    return { orders, total };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string, 
    updateOrderStatusDto: UpdateOrderStatusDto,
    actorId?: string,
    actorType?: string
  ): Promise<OrderEntity> {
    try {
      // Generate a transaction ID for this status update
      const transactionId = this.transactionService.generateTransactionId();
      
      this.logger.log(`Updating order ${orderId} status to ${updateOrderStatusDto.status} with transaction ID ${transactionId}`);
      
      // Use idempotency service to ensure the operation is idempotent
      return await this.idempotencyService.executeWithIdempotency(
        transactionId,
        { orderId, updateOrderStatusDto, actorId, actorType },
        async () => {
          // Verify order exists
          const order = await this.getOrderById(orderId);
          
          // Validate status transition
          this.validateStatusTransition(order.status, updateOrderStatusDto.status);
          
          // Update status
          return this.ordersRepository.updateOrderStatus(
            orderId, 
            updateOrderStatusDto,
            actorId,
            actorType
          );
        }
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error updating order status: ${error.message}`);
      } else {
        this.logger.error('Unknown error updating order status');
      }
      throw error;
    }
  }

  /**
   * Get order history
   */
  async getOrderHistory(orderId: string): Promise<OrderHistoryEntity[]> {
    // Verify order exists
    await this.getOrderById(orderId);
    
    // Get history
    return this.ordersRepository.getOrderHistory(orderId);
  }

  /**
   * Validate order status transition
   * Ensures that status changes follow a valid flow
   */
  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    // Define valid status transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.CREATED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
      [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
      [OrderStatus.REFUNDED]: []
    };
    
    // Check if transition is valid
    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}
