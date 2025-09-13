import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from '../src/modules/orders/orders.controller';
import { OrdersService } from '../src/modules/orders/orders.service';
import { OrderProcessingService } from '../src/modules/orders/services/order-processing.service';
import { CreateOrderDto } from '../src/modules/orders/dto/create-order.dto';
import { UpdateOrderStatusDto } from '../src/modules/orders/dto/update-order-status.dto';
import { OrderStatus } from '../src/modules/orders/constants/order-status.enum';
import { PaymentStatus } from '../src/modules/orders/constants/payment-status.enum';
import { OrderResponseDto } from '../src/modules/orders/dto/order-response.dto';

describe('When using OrdersController', () => {
  let controller: OrdersController;
  let ordersService: OrdersService;
  let orderProcessingService: OrderProcessingService;

  const mockOrdersService = {
    createOrder: jest.fn(),
    getOrderById: jest.fn(),
    getOrdersByUserId: jest.fn(),
    getOrdersByRestaurantId: jest.fn(),
    updateOrderStatus: jest.fn(),
    getOrderHistory: jest.fn(),
  };

  const mockOrderProcessingService = {
    processNewOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: OrderProcessingService,
          useValue: mockOrderProcessingService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    ordersService = module.get<OrdersService>(OrdersService);
    orderProcessingService = module.get<OrderProcessingService>(OrderProcessingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When creating an order', () => {
    const userId = 'user-123';
    const createOrderDto: CreateOrderDto = {
      restaurantId: 'restaurant-123',
      items: [
        {
          menuItemId: 'menu-item-123',
          name: 'Burger',
          quantity: 2,
          unitPriceCents: 1000,
        },
      ],
      deliveryAddress: '123 Main St',
    };

    const mockOrder = {
      id: 'order-123',
      userId,
      restaurantId: createOrderDto.restaurantId,
      transactionId: 'transaction-123',
      status: OrderStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      subtotalCents: 2000,
      taxCents: 200,
      deliveryFeeCents: 299,
      tipCents: 0,
      totalCents: 2499,
      currency: 'USD',
      deliveryAddress: createOrderDto.deliveryAddress,
      items: [
        {
          id: 'order-item-123',
          orderId: 'order-123',
          menuItemId: 'menu-item-123',
          name: 'Burger',
          quantity: 2,
          unitPriceCents: 1000,
          totalPriceCents: 2000,
          currency: 'USD',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('Then should create an order and start processing', async () => {
      // Arrange
      mockOrdersService.createOrder.mockResolvedValue(mockOrder);
      mockOrderProcessingService.processNewOrder.mockResolvedValue(undefined);

      // Act
      const result = await controller.createOrder({ user: { id: userId } } as any, createOrderDto);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        id: mockOrder.id,
        userId: mockOrder.userId,
        restaurantId: mockOrder.restaurantId,
        status: mockOrder.status,
      }));
      expect(ordersService.createOrder).toHaveBeenCalledWith(userId, createOrderDto);
      expect(orderProcessingService.processNewOrder).toHaveBeenCalledWith(mockOrder.id);
    });
  });

  describe('When getting an order by ID', () => {
    const orderId = 'order-123';
    const mockOrder = {
      id: orderId,
      userId: 'user-123',
      restaurantId: 'restaurant-123',
      status: OrderStatus.CREATED,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };

    it('Then should return the order', async () => {
      // Arrange
      mockOrdersService.getOrderById.mockResolvedValue(mockOrder);

      // Act
      const result = await controller.getOrderById({} as any, orderId);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        id: mockOrder.id,
        userId: mockOrder.userId,
        restaurantId: mockOrder.restaurantId,
        status: mockOrder.status,
      }));
      expect(ordersService.getOrderById).toHaveBeenCalledWith(orderId);
    });
  });

  describe('When getting user orders', () => {
    const userId = 'user-123';
    const mockOrders = [
      {
        id: 'order-123',
        userId,
        restaurantId: 'restaurant-123',
        status: OrderStatus.CREATED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      },
      {
        id: 'order-456',
        userId,
        restaurantId: 'restaurant-456',
        status: OrderStatus.DELIVERED,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      },
    ];

    it('Then should return user orders', async () => {
      // Arrange
      mockOrdersService.getOrdersByUserId.mockResolvedValue({
        orders: mockOrders,
        total: 2,
      });

      // Act
      const result = await controller.getMyOrders({ user: { id: userId } } as any, 1, 10);

      // Assert
      expect(result).toEqual({
        orders: expect.arrayContaining([
          expect.objectContaining({ id: 'order-123' }),
          expect.objectContaining({ id: 'order-456' }),
        ]),
        total: 2,
      });
      expect(ordersService.getOrdersByUserId).toHaveBeenCalledWith(userId, 1, 10);
    });
  });

  describe('When updating order status', () => {
    const orderId = 'order-123';
    const userId = 'user-123';
    const userRole = 'restaurant_owner';
    const updateDto: UpdateOrderStatusDto = {
      status: OrderStatus.CONFIRMED,
    };
    const mockOrder = {
      id: orderId,
      userId,
      restaurantId: 'restaurant-123',
      status: OrderStatus.CONFIRMED,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };

    it('Then should update order status', async () => {
      // Arrange
      mockOrdersService.updateOrderStatus.mockResolvedValue(mockOrder);

      // Act
      const result = await controller.updateOrderStatus(
        { user: { id: userId, role: userRole } } as any,
        orderId,
        updateDto
      );

      // Assert
      expect(result).toEqual(expect.objectContaining({
        id: mockOrder.id,
        status: OrderStatus.CONFIRMED,
      }));
      expect(ordersService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        updateDto,
        userId,
        userRole
      );
    });
  });

  describe('When getting order history', () => {
    const orderId = 'order-123';
    const mockHistory = [
      {
        id: 'history-1',
        orderId,
        status: OrderStatus.CREATED,
        createdAt: new Date(),
      },
      {
        id: 'history-2',
        orderId,
        status: OrderStatus.CONFIRMED,
        createdAt: new Date(),
      },
    ];

    it('Then should return order history', async () => {
      // Arrange
      mockOrdersService.getOrderHistory.mockResolvedValue(mockHistory);

      // Act
      const result = await controller.getOrderHistory(orderId);

      // Assert
      expect(result).toEqual(mockHistory);
      expect(ordersService.getOrderHistory).toHaveBeenCalledWith(orderId);
    });
  });
});
