import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '../src/modules/orders/orders.service';
import { OrdersRepository } from '../src/modules/orders/repositories/orders.repository';
import { IdempotencyService } from '../src/modules/orders/services/idempotency.service';
import { TransactionService } from '../src/modules/orders/services/transaction.service';
import { CreateOrderDto } from '../src/modules/orders/dto/create-order.dto';
import { OrderStatus } from '../src/modules/orders/constants/order-status.enum';
import { PaymentStatus } from '../src/modules/orders/constants/payment-status.enum';
import { UpdateOrderStatusDto } from '../src/modules/orders/dto/update-order-status.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('When using OrdersService', () => {
  let service: OrdersService;
  let repository: OrdersRepository;
  let idempotencyService: IdempotencyService;
  let transactionService: TransactionService;

  const mockOrdersRepository = {
    createOrder: jest.fn(),
    findOrderById: jest.fn(),
    findOrdersByUserId: jest.fn(),
    findOrdersByRestaurantId: jest.fn(),
    updateOrderStatus: jest.fn(),
    getOrderHistory: jest.fn(),
  };

  const mockIdempotencyService = {
    executeWithIdempotency: jest.fn(),
  };

  const mockTransactionService = {
    generateTransactionId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrdersRepository,
          useValue: mockOrdersRepository,
        },
        {
          provide: IdempotencyService,
          useValue: mockIdempotencyService,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    repository = module.get<OrdersRepository>(OrdersRepository);
    idempotencyService = module.get<IdempotencyService>(IdempotencyService);
    transactionService = module.get<TransactionService>(TransactionService);
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
    };

    it('Then should create an order successfully', async () => {
      // Arrange
      mockTransactionService.generateTransactionId.mockReturnValue('transaction-123');
      mockIdempotencyService.executeWithIdempotency.mockImplementation(
        (_, __, operation) => operation()
      );
      mockOrdersRepository.createOrder.mockResolvedValue(mockOrder);

      // Act
      const result = await service.createOrder(userId, createOrderDto);

      // Assert
      expect(result).toEqual(mockOrder);
      expect(mockIdempotencyService.executeWithIdempotency).toHaveBeenCalled();
      expect(mockOrdersRepository.createOrder).toHaveBeenCalledWith(userId, {
        ...createOrderDto,
        transactionId: 'transaction-123',
      });
    });

    it('Then should use provided transaction ID for idempotency', async () => {
      // Arrange
      const dtoWithTransactionId = {
        ...createOrderDto,
        transactionId: 'existing-transaction-123',
      };
      mockIdempotencyService.executeWithIdempotency.mockImplementation(
        (_, __, operation) => operation()
      );
      mockOrdersRepository.createOrder.mockResolvedValue({
        ...mockOrder,
        transactionId: 'existing-transaction-123',
      });

      // Act
      const result = await service.createOrder(userId, dtoWithTransactionId);

      // Assert
      expect(result.transactionId).toEqual('existing-transaction-123');
      expect(mockTransactionService.generateTransactionId).not.toHaveBeenCalled();
      expect(mockOrdersRepository.createOrder).toHaveBeenCalledWith(userId, dtoWithTransactionId);
    });

    it('Then should handle duplicate transaction ID error', async () => {
      // Arrange
      mockTransactionService.generateTransactionId.mockReturnValue('transaction-123');
      mockIdempotencyService.executeWithIdempotency.mockImplementation(
        (_, __, operation) => operation()
      );
      mockOrdersRepository.createOrder.mockRejectedValue({ code: '23505' });

      // Act & Assert
      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('When getting an order by ID', () => {
    const orderId = 'order-123';
    const mockOrder = {
      id: orderId,
      userId: 'user-123',
      restaurantId: 'restaurant-123',
      status: OrderStatus.CREATED,
    };

    it('Then should return the order if found', async () => {
      // Arrange
      mockOrdersRepository.findOrderById.mockResolvedValue(mockOrder);

      // Act
      const result = await service.getOrderById(orderId);

      // Assert
      expect(result).toEqual(mockOrder);
      expect(mockOrdersRepository.findOrderById).toHaveBeenCalledWith(orderId);
    });

    it('Then should throw NotFoundException if order not found', async () => {
      // Arrange
      mockOrdersRepository.findOrderById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getOrderById(orderId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('When updating order status', () => {
    const orderId = 'order-123';
    const mockOrder = {
      id: orderId,
      userId: 'user-123',
      restaurantId: 'restaurant-123',
      status: OrderStatus.CREATED,
    };
    const updateDto: UpdateOrderStatusDto = {
      status: OrderStatus.CONFIRMED,
    };

    it('Then should update order status successfully', async () => {
      // Arrange
      mockOrdersRepository.findOrderById.mockResolvedValue(mockOrder);
      mockIdempotencyService.executeWithIdempotency.mockImplementation(
        (_, __, operation) => operation()
      );
      mockOrdersRepository.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
      });
      mockTransactionService.generateTransactionId.mockReturnValue('transaction-123');

      // Act
      const result = await service.updateOrderStatus(orderId, updateDto);

      // Assert
      expect(result.status).toEqual(OrderStatus.CONFIRMED);
      expect(mockOrdersRepository.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        updateDto,
        undefined,
        undefined
      );
    });

    it('Then should throw BadRequestException for invalid status transition', async () => {
      // Arrange
      mockOrdersRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });
      mockTransactionService.generateTransactionId.mockReturnValue('transaction-123');

      // Act & Assert
      await expect(
        service.updateOrderStatus(orderId, { status: OrderStatus.PREPARING })
      ).rejects.toThrow(BadRequestException);
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
      mockOrdersRepository.findOrderById.mockResolvedValue({ id: orderId });
      mockOrdersRepository.getOrderHistory.mockResolvedValue(mockHistory);

      // Act
      const result = await service.getOrderHistory(orderId);

      // Assert
      expect(result).toEqual(mockHistory);
      expect(mockOrdersRepository.getOrderHistory).toHaveBeenCalledWith(orderId);
    });

    it('Then should throw NotFoundException if order not found', async () => {
      // Arrange
      mockOrdersRepository.findOrderById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getOrderHistory(orderId)).rejects.toThrow(NotFoundException);
    });
  });
});
