import { Test, TestingModule } from '@nestjs/testing';
import { OrderProcessingService } from '../src/modules/orders/services/order-processing.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import { OrderStatus } from '../src/modules/orders/constants/order-status.enum';
import { PaymentStatus } from '../src/modules/orders/constants/payment-status.enum';
import { UpdateOrderStatusDto } from '../src/modules/orders/dto/update-order-status.dto';

describe('When using OrderProcessingService', () => {
  let service: OrderProcessingService;
  let ordersService: OrdersService;

  const mockOrdersService = {
    getOrderById: jest.fn(),
    updateOrderStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderProcessingService,
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    service = module.get<OrderProcessingService>(OrderProcessingService);
    ordersService = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When processing a new order', () => {
    const orderId = 'order-123';
    const mockOrder = {
      id: orderId,
      userId: 'user-123',
      restaurantId: 'restaurant-123',
      status: OrderStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      items: [
        {
          id: 'item-123',
          menuItemId: 'menu-item-123',
          name: 'Burger',
          quantity: 2,
        },
      ],
    };

    it('Then should process and confirm the order', async () => {
      // Arrange
      mockOrdersService.getOrderById.mockResolvedValue(mockOrder);
      mockOrdersService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
      });

      // Act
      await service.processNewOrder(orderId);

      // Assert
      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(orderId);
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          status: OrderStatus.CONFIRMED,
        }),
        'system',
        'system'
      );
    });

    it('Then should handle invalid order data', async () => {
      // Arrange
      mockOrdersService.getOrderById.mockResolvedValue({ ...mockOrder, items: [] });

      // Act
      await service.processNewOrder(orderId);

      // Assert
      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(orderId);
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('Then should handle errors during processing', async () => {
      // Arrange
      mockOrdersService.getOrderById.mockRejectedValue(new Error('Database error'));

      // Act
      await service.processNewOrder(orderId);

      // Assert
      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(orderId);
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
    });
  });

  describe('When marking order as preparing', () => {
    const orderId = 'order-123';
    const actorId = 'restaurant-123';
    const mockOrder = {
      id: orderId,
      status: OrderStatus.PREPARING,
    };

    it('Then should update order status to preparing', async () => {
      // Arrange
      mockOrdersService.updateOrderStatus.mockResolvedValue(mockOrder);

      // Act
      await service.markOrderAsPreparing(orderId, actorId);

      // Assert
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          status: OrderStatus.PREPARING,
        }),
        actorId,
        'restaurant_owner'
      );
    });
  });

  describe('When marking order as ready for pickup', () => {
    const orderId = 'order-123';
    const actorId = 'restaurant-123';
    const mockOrder = {
      id: orderId,
      status: OrderStatus.READY_FOR_PICKUP,
    };

    it('Then should update order status to ready for pickup', async () => {
      // Arrange
      mockOrdersService.updateOrderStatus.mockResolvedValue(mockOrder);

      // Act
      await service.markOrderAsReadyForPickup(orderId, actorId);

      // Assert
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          status: OrderStatus.READY_FOR_PICKUP,
        }),
        actorId,
        'restaurant_owner'
      );
    });
  });

  describe('When marking order as out for delivery', () => {
    const orderId = 'order-123';
    const driverId = 'driver-123';
    const mockOrder = {
      id: orderId,
      status: OrderStatus.OUT_FOR_DELIVERY,
    };

    it('Then should update order status to out for delivery', async () => {
      // Arrange
      mockOrdersService.updateOrderStatus.mockResolvedValue(mockOrder);

      // Act
      await service.markOrderAsOutForDelivery(orderId, driverId);

      // Assert
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          status: OrderStatus.OUT_FOR_DELIVERY,
        }),
        driverId,
        'driver'
      );
    });
  });

  describe('When marking order as delivered', () => {
    const orderId = 'order-123';
    const driverId = 'driver-123';
    const mockOrder = {
      id: orderId,
      status: OrderStatus.DELIVERED,
    };

    it('Then should update order status to delivered', async () => {
      // Arrange
      mockOrdersService.updateOrderStatus.mockResolvedValue(mockOrder);

      // Act
      await service.markOrderAsDelivered(orderId, driverId);

      // Assert
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          status: OrderStatus.DELIVERED,
        }),
        driverId,
        'driver'
      );
    });
  });

  describe('When cancelling an order', () => {
    const orderId = 'order-123';
    const actorId = 'user-123';
    const actorType = 'customer';
    const reason = 'Changed my mind';
    const mockOrder = {
      id: orderId,
      status: OrderStatus.CANCELLED,
    };

    it('Then should update order status to cancelled', async () => {
      // Arrange
      mockOrdersService.updateOrderStatus.mockResolvedValue(mockOrder);

      // Act
      await service.cancelOrder(orderId, actorId, actorType, reason);

      // Assert
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({
          status: OrderStatus.CANCELLED,
          note: expect.stringContaining(reason),
        }),
        actorId,
        actorType
      );
    });
  });
});
