import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { OrderStatus } from '../constants/order-status.enum';
import { PaymentStatus } from '../constants/payment-status.enum';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';

/**
 * Service for handling order processing workflow
 */
@Injectable()
export class OrderProcessingService {
  private readonly logger = new Logger(OrderProcessingService.name);

  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Process a new order through the workflow
   * @param orderId The ID of the order to process
   */
  async processNewOrder(orderId: string): Promise<void> {
    try {
      // Get the order
      const order = await this.ordersService.getOrderById(orderId);
      
      // Validate order data
      if (!order || !order.items || order.items.length === 0) {
        this.logger.error(`Invalid order data for order ${orderId}`);
        return;
      }
      
      // Log the start of processing
      this.logger.log(`Starting processing for order ${orderId}`);
      
      // Confirm the order (in a real system, this would involve payment processing)
      await this.confirmOrder(orderId);
      
      // In a real system, we would send notifications to the restaurant
      this.logger.log(`Order ${orderId} confirmed and sent to restaurant`);
    } catch (error) {
      this.logger.error(`Error processing order ${orderId}: ${error.message}`);
      // In a real system, we would handle the error and potentially retry
    }
  }

  /**
   * Confirm an order after validation and payment
   * @param orderId The ID of the order to confirm
   */
  async confirmOrder(orderId: string): Promise<void> {
    const updateDto: UpdateOrderStatusDto = {
      status: OrderStatus.CONFIRMED,
      note: 'Order confirmed automatically after validation'
    };
    
    await this.ordersService.updateOrderStatus(
      orderId,
      updateDto,
      'system',
      'system'
    );
    
    this.logger.log(`Order ${orderId} confirmed`);
  }

  /**
   * Mark an order as preparing (called by restaurant)
   * @param orderId The ID of the order
   * @param actorId The ID of the user making the change
   */
  async markOrderAsPreparing(orderId: string, actorId: string): Promise<void> {
    const updateDto: UpdateOrderStatusDto = {
      status: OrderStatus.PREPARING,
      note: 'Restaurant started preparing the order'
    };
    
    await this.ordersService.updateOrderStatus(
      orderId,
      updateDto,
      actorId,
      'restaurant_owner'
    );
    
    this.logger.log(`Order ${orderId} marked as preparing`);
  }

  /**
   * Mark an order as ready for pickup (called by restaurant)
   * @param orderId The ID of the order
   * @param actorId The ID of the user making the change
   */
  async markOrderAsReadyForPickup(orderId: string, actorId: string): Promise<void> {
    const updateDto: UpdateOrderStatusDto = {
      status: OrderStatus.READY_FOR_PICKUP,
      note: 'Order is ready for pickup by driver'
    };
    
    await this.ordersService.updateOrderStatus(
      orderId,
      updateDto,
      actorId,
      'restaurant_owner'
    );
    
    this.logger.log(`Order ${orderId} marked as ready for pickup`);
    
    // In a real system, we would notify available drivers
  }

  /**
   * Assign a driver to an order
   * @param orderId The ID of the order
   * @param driverId The ID of the driver
   */
  async assignDriverToOrder(orderId: string, driverId: string): Promise<void> {
    // Get the order
    const order = await this.ordersService.getOrderById(orderId);
    
    // Update the order with the driver ID
    // In a real system, this would be a separate method in the orders service
    
    this.logger.log(`Driver ${driverId} assigned to order ${orderId}`);
  }

  /**
   * Mark an order as out for delivery (called by driver)
   * @param orderId The ID of the order
   * @param driverId The ID of the driver
   */
  async markOrderAsOutForDelivery(orderId: string, driverId: string): Promise<void> {
    const updateDto: UpdateOrderStatusDto = {
      status: OrderStatus.OUT_FOR_DELIVERY,
      note: 'Driver picked up the order and is on the way'
    };
    
    await this.ordersService.updateOrderStatus(
      orderId,
      updateDto,
      driverId,
      'driver'
    );
    
    this.logger.log(`Order ${orderId} marked as out for delivery by driver ${driverId}`);
    
    // In a real system, we would update the customer with the estimated delivery time
  }

  /**
   * Mark an order as delivered (called by driver)
   * @param orderId The ID of the order
   * @param driverId The ID of the driver
   */
  async markOrderAsDelivered(orderId: string, driverId: string): Promise<void> {
    const updateDto: UpdateOrderStatusDto = {
      status: OrderStatus.DELIVERED,
      note: 'Order successfully delivered to customer'
    };
    
    await this.ordersService.updateOrderStatus(
      orderId,
      updateDto,
      driverId,
      'driver'
    );
    
    this.logger.log(`Order ${orderId} marked as delivered by driver ${driverId}`);
    
    // In a real system, we would send a confirmation to the customer
    // and potentially ask for a review
  }

  /**
   * Cancel an order (can be called by customer, restaurant, or admin)
   * @param orderId The ID of the order
   * @param actorId The ID of the user making the change
   * @param actorType The type of user making the change
   * @param reason The reason for cancellation
   */
  async cancelOrder(
    orderId: string, 
    actorId: string, 
    actorType: string,
    reason: string
  ): Promise<void> {
    const updateDto: UpdateOrderStatusDto = {
      status: OrderStatus.CANCELLED,
      note: `Order cancelled by ${actorType}: ${reason}`
    };
    
    await this.ordersService.updateOrderStatus(
      orderId,
      updateDto,
      actorId,
      actorType
    );
    
    this.logger.log(`Order ${orderId} cancelled by ${actorType} ${actorId}: ${reason}`);
    
    // In a real system, we would handle refunds if payment was already processed
  }
}
