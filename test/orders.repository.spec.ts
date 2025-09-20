import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository, EntityManager } from 'typeorm';
import { OrdersRepository } from '../src/modules/orders/repositories/orders.repository';
import { OrderEntity } from '../src/modules/orders/entities/order.entity';
import { OrderItemEntity } from '../src/modules/orders/entities/order-item.entity';
import { OrderHistoryEntity } from '../src/modules/orders/entities/order-history.entity';
import { OrderStatus } from '../src/modules/orders/constants/order-status.enum';
import { PaymentStatus } from '../src/modules/orders/constants/payment-status.enum';
import { TransactionService } from '../src/modules/orders/services/transaction.service';
import { DatabaseConnectionService } from '../src/modules/orders/services/database-connection.service';
import { ShardingService } from '../src/modules/orders/services/sharding.service';

describe('When using OrdersRepository', () => {
  let repository: OrdersRepository;
  let orderRepo: Repository<OrderEntity>;
  let orderItemRepo: Repository<OrderItemEntity>;
  let orderHistoryRepo: Repository<OrderHistoryEntity>;
  let transactionService: TransactionService;
  let databaseConnectionService: DatabaseConnectionService;
  let shardingService: ShardingService;

  const mockOrderRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
  };

  const mockOrderItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockOrderHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockTransactionService = {
    executeWithRetry: jest.fn(),
    executeInTransaction: jest.fn(),
    generateTransactionId: jest.fn(),
  };

  const mockDatabaseConnectionService = {
    getDataSource: jest.fn(),
    getPoolSize: jest.fn(),
  };

  const mockShardingService = {
    generateOrderId: jest.fn(),
    getShardCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersRepository,
        {
          provide: getRepositoryToken(OrderEntity),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(OrderItemEntity),
          useValue: mockOrderItemRepository,
        },
        {
          provide: getRepositoryToken(OrderHistoryEntity),
          useValue: mockOrderHistoryRepository,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
        {
          provide: DatabaseConnectionService,
          useValue: mockDatabaseConnectionService,
        },
        {
          provide: ShardingService,
          useValue: mockShardingService,
        },
        {
          provide: 'CONNECTION_POOL_SIZE',
          useValue: 50,
        },
      ],
    }).compile();

    repository = module.get<OrdersRepository>(OrdersRepository);
    orderRepo = module.get<Repository<OrderEntity>>(getRepositoryToken(OrderEntity));
    orderItemRepo = module.get<Repository<OrderItemEntity>>(getRepositoryToken(OrderItemEntity));
    orderHistoryRepo = module.get<Repository<OrderHistoryEntity>>(
      getRepositoryToken(OrderHistoryEntity),
    );
    transactionService = module.get<TransactionService>(TransactionService);
    databaseConnectionService = module.get<DatabaseConnectionService>(DatabaseConnectionService);
    shardingService = module.get<ShardingService>(ShardingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When finding an order by ID', () => {
    const orderId = 'order-123';
    const mockOrder = {
      id: orderId,
      userId: 'user-123',
      restaurantId: 'restaurant-123',
      transactionId: 'transaction-123',
      status: OrderStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      subtotalCents: 2000,
      taxCents: 200,
      deliveryFeeCents: 299,
      tipCents: 0,
      totalCents: 2499,
      currency: 'USD',
      deliveryAddress: '123 Main St',
      shardKey: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item-123',
          orderId,
          menuItemId: 'menu-item-123',
          name: 'Burger',
          quantity: 2,
          unitPriceCents: 1000,
          totalPriceCents: 2000,
          currency: 'USD',
        },
      ],
    };

    it('Then should return the order with items if found', async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      // Act
      const result = await repository.findOrderById(orderId);

      // Assert
      expect(result).toEqual(mockOrder);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: orderId },
        relations: ['items'],
      });
    });

    it('Then should return null if order not found', async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await repository.findOrderById(orderId);

      // Assert
      expect(result).toBeNull();
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: orderId },
        relations: ['items'],
      });
    });
  });

  describe('When finding orders by user ID', () => {
    const userId = 'user-123';
    const limit = 10;
    const offset = 0;
    const mockOrders = [
      {
        id: 'order-1',
        userId,
        restaurantId: 'restaurant-123',
        status: OrderStatus.CREATED,
        createdAt: new Date(),
        items: [],
      },
      {
        id: 'order-2',
        userId,
        restaurantId: 'restaurant-456',
        status: OrderStatus.DELIVERED,
        createdAt: new Date(),
        items: [],
      },
    ];
    const totalCount = 2;

    it('Then should return orders with pagination', async () => {
      // Arrange
      mockOrderRepository.findAndCount.mockResolvedValue([mockOrders, totalCount]);

      // Act
      const result = await repository.findOrdersByUserId(userId, limit, offset);

      // Assert
      expect(result).toEqual([mockOrders, totalCount]);
      expect(mockOrderRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        relations: ['items'],
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });
    });

    it('Then should use default pagination values when not provided', async () => {
      // Arrange
      mockOrderRepository.findAndCount.mockResolvedValue([mockOrders, totalCount]);

      // Act
      const result = await repository.findOrdersByUserId(userId);

      // Assert
      expect(result).toEqual([mockOrders, totalCount]);
      expect(mockOrderRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        relations: ['items'],
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
    });

    it('Then should return empty array when no orders found', async () => {
      // Arrange
      mockOrderRepository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      const result = await repository.findOrdersByUserId(userId);

      // Assert
      expect(result).toEqual([[], 0]);
    });
  });

  describe('When finding orders by restaurant ID', () => {
    const restaurantId = 'restaurant-123';
    const limit = 20;
    const offset = 10;
    const mockOrders = [
      {
        id: 'order-1',
        userId: 'user-123',
        restaurantId,
        status: OrderStatus.PREPARING,
        createdAt: new Date(),
        items: [],
      },
    ];
    const totalCount = 1;

    it('Then should return orders with custom pagination', async () => {
      // Arrange
      mockOrderRepository.findAndCount.mockResolvedValue([mockOrders, totalCount]);

      // Act
      const result = await repository.findOrdersByRestaurantId(restaurantId, limit, offset);

      // Assert
      expect(result).toEqual([mockOrders, totalCount]);
      expect(mockOrderRepository.findAndCount).toHaveBeenCalledWith({
        where: { restaurantId },
        relations: ['items'],
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });
    });

    it('Then should use default pagination values when not provided', async () => {
      // Arrange
      mockOrderRepository.findAndCount.mockResolvedValue([mockOrders, totalCount]);

      // Act
      const result = await repository.findOrdersByRestaurantId(restaurantId);

      // Assert
      expect(result).toEqual([mockOrders, totalCount]);
      expect(mockOrderRepository.findAndCount).toHaveBeenCalledWith({
        where: { restaurantId },
        relations: ['items'],
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
    });
  });

  describe('When getting order history', () => {
    const orderId = 'order-123';
    const mockHistory = [
      {
        id: 'history-1',
        orderId,
        status: OrderStatus.CREATED,
        note: 'Order created',
        createdAt: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: 'history-2',
        orderId,
        status: OrderStatus.CONFIRMED,
        note: 'Order confirmed',
        actorId: 'user-456',
        actorType: 'restaurant',
        createdAt: new Date('2024-01-01T10:15:00Z'),
      },
    ];

    it('Then should return order history ordered by creation date', async () => {
      // Arrange
      mockOrderHistoryRepository.find.mockResolvedValue(mockHistory);

      // Act
      const result = await repository.getOrderHistory(orderId);

      // Assert
      expect(result).toEqual(mockHistory);
      expect(mockOrderHistoryRepository.find).toHaveBeenCalledWith({
        where: { orderId },
        order: { createdAt: 'ASC' },
      });
    });

    it('Then should return empty array when no history found', async () => {
      // Arrange
      mockOrderHistoryRepository.find.mockResolvedValue([]);

      // Act
      const result = await repository.getOrderHistory(orderId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('When creating an order', () => {
    const userId = 'user-123';
    const createOrderDto = {
      restaurantId: 'restaurant-123',
      items: [
        {
          menuItemId: 'menu-item-123',
          name: 'Burger',
          quantity: 2,
          unitPriceCents: 1000,
          description: 'Delicious burger',
          customizations: { extraCheese: true },
        },
      ],
      deliveryAddress: '123 Main St',
      deliveryInstructions: 'Ring doorbell',
      currency: 'USD' as const,
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
      deliveryInstructions: createOrderDto.deliveryInstructions,
      shardKey: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'order-item-123',
          orderId: 'order-123',
          menuItemId: 'menu-item-123',
          name: 'Burger',
          description: 'Delicious burger',
          quantity: 2,
          unitPriceCents: 1000,
          totalPriceCents: 2000,
          currency: 'USD',
          customizations: { extraCheese: true },
        },
      ],
    };

    it('Then should create an order successfully', async () => {
      // Arrange
      const mockEntityManager = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
      };

      mockEntityManager.create
        .mockReturnValueOnce(mockOrder)
        .mockReturnValueOnce(mockOrder.items[0])
        .mockReturnValueOnce({
          orderId: mockOrder.id,
          status: OrderStatus.CREATED,
          note: 'Order created',
        });

      mockEntityManager.save
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce([mockOrder.items[0]])
        .mockResolvedValueOnce({
          orderId: mockOrder.id,
          status: OrderStatus.CREATED,
          note: 'Order created',
        });

      mockEntityManager.findOne.mockResolvedValue(null);

      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      mockTransactionService.generateTransactionId.mockReturnValue('transaction-123');
      mockShardingService.generateOrderId.mockReturnValue({ orderId: 'order-123', shardKey: 5 });
      mockTransactionService.executeWithRetry.mockImplementation(
        async (operation: () => Promise<OrderEntity>) => {
          return await operation();
        },
      );
      mockTransactionService.executeInTransaction.mockImplementation(
        async (operation: (manager: any) => Promise<OrderEntity>) => {
          return await operation(mockEntityManager);
        },
      );

      // Act
      const result = await repository.createOrder(userId, createOrderDto);

      // Assert
      expect(result).toEqual(mockOrder);
      expect(mockTransactionService.generateTransactionId).toHaveBeenCalled();
      expect(mockShardingService.generateOrderId).toHaveBeenCalled();
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        OrderEntity,
        expect.objectContaining({
          id: 'order-123',
          userId,
          restaurantId: createOrderDto.restaurantId,
          transactionId: 'transaction-123',
          status: OrderStatus.CREATED,
          paymentStatus: PaymentStatus.PENDING,
          subtotalCents: 2000,
          taxCents: 200,
          deliveryFeeCents: 299,
          totalCents: 2499,
          shardKey: 5,
        }),
      );
    });

    it('Then should handle existing transaction ID for idempotency', async () => {
      // Arrange
      const dtoWithTransactionId = {
        ...createOrderDto,
        transactionId: 'existing-transaction-123',
      };

      // Mock the entity manager for idempotency check
      const mockEntityManager = {
        findOne: jest.fn(),
      };
      mockEntityManager.findOne.mockResolvedValue(mockOrder);

      mockTransactionService.generateTransactionId.mockReturnValue('new-transaction-123');
      mockTransactionService.executeWithRetry.mockImplementation(
        async (operation: () => Promise<OrderEntity>) => {
          return await operation();
        },
      );
      mockTransactionService.executeInTransaction.mockImplementation(
        async (operation: (manager: any) => Promise<OrderEntity>) => {
          return await operation(mockEntityManager);
        },
      );

      // Act
      const result = await repository.createOrder(userId, dtoWithTransactionId);

      // Assert
      expect(result).toEqual(mockOrder);
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(OrderEntity, {
        where: { transactionId: 'existing-transaction-123' },
      });
    });

    it('Then should use transaction service for order creation', async () => {
      // Arrange
      const mockEntityManager = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
      };

      mockEntityManager.create
        .mockReturnValueOnce(mockOrder)
        .mockReturnValueOnce(mockOrder.items[0])
        .mockReturnValueOnce({
          orderId: mockOrder.id,
          status: OrderStatus.CREATED,
          note: 'Order created',
        })
        // Set up for second retry attempt
        .mockReturnValueOnce(mockOrder)
        .mockReturnValueOnce(mockOrder.items[0])
        .mockReturnValueOnce({
          orderId: mockOrder.id,
          status: OrderStatus.CREATED,
          note: 'Order created',
        });

      mockEntityManager.save
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce([mockOrder.items[0]])
        .mockResolvedValueOnce({
          orderId: mockOrder.id,
          status: OrderStatus.CREATED,
          note: 'Order created',
        })
        // Set up for second retry attempt
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce([mockOrder.items[0]])
        .mockResolvedValueOnce({
          orderId: mockOrder.id,
          status: OrderStatus.CREATED,
          note: 'Order created',
        });

      mockEntityManager.findOne.mockResolvedValue(null);
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);

      mockTransactionService.generateTransactionId.mockReturnValue('transaction-123');
      mockShardingService.generateOrderId.mockReturnValue({ orderId: 'order-123', shardKey: 5 });

      mockTransactionService.executeWithRetry.mockImplementation(async (operation) => {
        return await operation();
      });

      mockTransactionService.executeInTransaction.mockImplementation(async (operation) => {
        return await operation(mockEntityManager);
      });

      // Act
      const result = await repository.createOrder(userId, createOrderDto);

      // Assert
      expect(result).toEqual(mockOrder);
      expect(mockTransactionService.executeWithRetry).toHaveBeenCalledTimes(1);
      expect(mockTransactionService.executeInTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('When updating order status', () => {
    const orderId = 'order-123';
    const updateDto = {
      status: OrderStatus.CONFIRMED,
      note: 'Order confirmed by restaurant',
    };

    const existingOrder = {
      id: orderId,
      userId: 'user-123',
      restaurantId: 'restaurant-123',
      status: OrderStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };

    const updatedOrder = {
      ...existingOrder,
      status: OrderStatus.CONFIRMED,
      updatedAt: new Date(),
    };

    it('Then should update order status successfully', async () => {
      // Arrange
      const mockEntityManager = {
        update: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      };

      mockEntityManager.create.mockReturnValue({
        orderId,
        status: OrderStatus.CONFIRMED,
        note: updateDto.note,
        actorId: 'actor-123',
        actorType: 'restaurant',
      });

      mockEntityManager.save.mockResolvedValue({
        orderId,
        status: OrderStatus.CONFIRMED,
        note: updateDto.note,
      });

      mockOrderRepository.findOne.mockResolvedValue(updatedOrder);

      mockTransactionService.executeWithRetry.mockImplementation(async (operation) => {
        return operation();
      });
      mockTransactionService.executeInTransaction.mockImplementation(async (operation) => {
        return operation(mockEntityManager);
      });

      // Act
      const result = await repository.updateOrderStatus(
        orderId,
        updateDto,
        'actor-123',
        'restaurant',
      );

      // Assert
      expect(result).toEqual(updatedOrder);
      expect(mockEntityManager.update).toHaveBeenCalledWith(OrderEntity, orderId, {
        status: OrderStatus.CONFIRMED,
        updatedAt: expect.any(Date),
      });
      expect(mockEntityManager.create).toHaveBeenCalledWith(OrderHistoryEntity, {
        orderId,
        status: OrderStatus.CONFIRMED,
        note: updateDto.note,
        actorId: 'actor-123',
        actorType: 'restaurant',
      });
    });

    it('Then should update status without actor information', async () => {
      // Arrange
      const mockEntityManager = {
        update: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      };

      mockEntityManager.create.mockReturnValue({
        orderId,
        status: OrderStatus.CONFIRMED,
        note: updateDto.note,
      });

      mockEntityManager.save.mockResolvedValue({
        orderId,
        status: OrderStatus.CONFIRMED,
        note: updateDto.note,
      });

      mockOrderRepository.findOne.mockResolvedValue(updatedOrder);

      mockTransactionService.executeWithRetry.mockImplementation(async (operation) => {
        return operation();
      });
      mockTransactionService.executeInTransaction.mockImplementation(async (operation) => {
        return operation(mockEntityManager);
      });

      // Act
      const result = await repository.updateOrderStatus(orderId, updateDto);

      // Assert
      expect(result).toEqual(updatedOrder);
      expect(mockEntityManager.create).toHaveBeenCalledWith(OrderHistoryEntity, {
        orderId,
        status: OrderStatus.CONFIRMED,
        note: updateDto.note,
        actorId: undefined,
        actorType: undefined,
      });
    });

    it('Then should throw error if order not found after update', async () => {
      // Arrange
      const mockEntityManager = {
        update: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      };

      mockEntityManager.update.mockResolvedValue(undefined);
      mockEntityManager.save.mockResolvedValue(undefined);

      mockOrderRepository.findOne.mockResolvedValue(null);

      mockTransactionService.executeWithRetry.mockImplementation(async (operation) => {
        return operation();
      });
      mockTransactionService.executeInTransaction.mockImplementation(async (operation) => {
        return operation(mockEntityManager);
      });

      // Act & Assert
      await expect(repository.updateOrderStatus(orderId, updateDto)).rejects.toThrow(
        'Failed to find updated order with ID order-123',
      );
    });
  });
});
