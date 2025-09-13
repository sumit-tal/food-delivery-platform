import { 
  Controller, 
  Post, 
  Get, 
  Patch, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';
import { OrdersService } from './orders.service';
import { OrderProcessingService } from './services/order-processing.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderStatus } from './constants/order-status.enum';
import { OrderHistoryEntity } from './entities/order-history.entity';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';

interface RequestWithUser {
  user: {
    id: string;
    role: UserRole;
  };
}

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderProcessingService: OrderProcessingService
  ) {}

  /**
   * Create a new order
   */
  @Post()
  @Roles(UserRole.CUSTOMER)
  async createOrder(
    @Request() req: RequestWithUser,
    @Body() createOrderDto: CreateOrderDto
  ): Promise<OrderResponseDto> {
    const userId = req.user.id;
    
    // Create the order
    const order = await this.ordersService.createOrder(userId, createOrderDto);
    
    // Start processing the order asynchronously
    // We don't await this to avoid blocking the response
    this.orderProcessingService.processNewOrder(order.id)
      .catch(error => {
        console.error(`Error processing order ${order.id}:`, error);
      });
    
    return this.mapToOrderResponseDto(order);
  }

  /**
   * Get an order by ID
   */
  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  async getOrderById(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<OrderResponseDto> {
    // Authorization check would be handled in a custom guard or interceptor
    // For now, we'll allow access if the user is the customer, restaurant owner, or admin
    const order = await this.ordersService.getOrderById(id);
    return this.mapToOrderResponseDto(order);
  }

  /**
   * Get orders for the current user
   */
  @Get('user/me')
  @Roles(UserRole.CUSTOMER)
  async getMyOrders(
    @Request() req: RequestWithUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
  ): Promise<{ orders: OrderResponseDto[]; total: number }> {
    const userId = req.user.id;
    const { orders, total } = await this.ordersService.getOrdersByUserId(userId, page, limit);
    return {
      orders: orders.map(order => this.mapToOrderResponseDto(order)),
      total
    };
  }

  /**
   * Get orders for a restaurant
   */
  @Get('restaurant/:restaurantId')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  async getRestaurantOrders(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
  ): Promise<{ orders: OrderResponseDto[]; total: number }> {
    // Authorization check would be handled in a custom guard or interceptor
    // For now, we'll allow access if the user is the restaurant owner or admin
    const { orders, total } = await this.ordersService.getOrdersByRestaurantId(restaurantId, page, limit);
    return {
      orders: orders.map(order => this.mapToOrderResponseDto(order)),
      total
    };
  }

  /**
   * Update order status
   */
  @Patch(':id/status')
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  async updateOrderStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto
  ): Promise<OrderResponseDto> {
    const actorId = req.user.id;
    const actorType = req.user.role;
    
    const order = await this.ordersService.updateOrderStatus(
      id, 
      updateOrderStatusDto,
      actorId,
      actorType
    );
    
    return this.mapToOrderResponseDto(order);
  }

  /**
   * Get order history
   */
  @Get(':id/history')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.DRIVER, UserRole.ADMIN)
  async getOrderHistory(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<OrderHistoryEntity[]> {
    return this.ordersService.getOrderHistory(id);
  }

  /**
   * Map OrderEntity to OrderResponseDto
   */
  private mapToOrderResponseDto(order: OrderEntity): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      restaurantId: order.restaurantId,
      transactionId: order.transactionId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotalCents: order.subtotalCents,
      taxCents: order.taxCents,
      deliveryFeeCents: order.deliveryFeeCents,
      tipCents: order.tipCents,
      totalCents: order.totalCents,
      currency: order.currency,
      deliveryAddress: order.deliveryAddress,
      deliveryInstructions: order.deliveryInstructions,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
      driverId: order.driverId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items?.map((item: OrderItemEntity) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalPriceCents: item.totalPriceCents,
        currency: item.currency,
        customizations: item.customizations
      })) || []
    };
  }
}
