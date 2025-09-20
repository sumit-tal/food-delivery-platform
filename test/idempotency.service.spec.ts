import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { IdempotencyService } from '../src/modules/orders/services/idempotency.service';
import { OrderTransactionEntity } from '../src/modules/orders/entities/order-transaction.entity';
import { TransactionService } from '../src/modules/orders/services/transaction.service';

describe('When using IdempotencyService', () => {
  let service: IdempotencyService;
  let transactionRepository: Repository<OrderTransactionEntity>;
  let transactionService: TransactionService;
  type UpdateQueryBuilder = {
    update: jest.Mock<UpdateQueryBuilder, [unknown]>;
    set: jest.Mock<UpdateQueryBuilder, [Record<string, unknown>]>;
    where: jest.Mock<UpdateQueryBuilder, [string, Record<string, unknown>]>;
    execute: jest.Mock<Promise<{ affected: number }>, []>;
  };
  let qb: UpdateQueryBuilder;

  const mockTransactionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTransactionService = {
    executeInTransaction: jest.fn(),
  };

  beforeEach(async () => {
    // Setup a default mock query builder chain for tests that complete transactions with a responsePayload
    const update = jest.fn<UpdateQueryBuilder, [unknown]>();
    const set = jest.fn<UpdateQueryBuilder, [Record<string, unknown>]>();
    const where = jest.fn<UpdateQueryBuilder, [string, Record<string, unknown>]>();
    const execute = jest.fn<Promise<{ affected: number }>, []>();
    qb = { update, set, where, execute } as UpdateQueryBuilder;
    update.mockReturnValue(qb);
    set.mockReturnValue(qb);
    where.mockReturnValue(qb);
    execute.mockResolvedValue({ affected: 1 });
    mockTransactionRepository.createQueryBuilder.mockReturnValue(qb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: getRepositoryToken(OrderTransactionEntity),
          useValue: mockTransactionRepository,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    transactionRepository = module.get<Repository<OrderTransactionEntity>>(
      getRepositoryToken(OrderTransactionEntity),
    );
    transactionService = module.get<TransactionService>(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When checking if a transaction exists', () => {
    const transactionId = 'transaction-123';
    const mockTransaction = {
      id: transactionId,
      status: 'completed',
      orderId: 'order-123',
    };

    it('Then should return the transaction if found', async () => {
      // Arrange
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      // Act
      const result = await service.checkTransactionExists(transactionId);

      // Assert
      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: transactionId },
      });
    });

    it('Then should return null if transaction not found', async () => {
      // Arrange
      mockTransactionRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.checkTransactionExists(transactionId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('When recording a transaction', () => {
    const transactionId = 'transaction-123';
    const requestPayload = { userId: 'user-123', orderData: { items: [] } };
    const mockTransaction = {
      id: transactionId,
      status: 'pending',
      requestPayload,
      attempts: 1,
    };

    it('Then should create and save a new transaction', async () => {
      // Arrange
      mockTransactionRepository.create.mockReturnValue(mockTransaction);
      mockTransactionRepository.save.mockResolvedValue(mockTransaction);

      // Act
      const result = await service.recordTransaction(transactionId, requestPayload);

      // Assert
      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.create).toHaveBeenCalledWith({
        id: transactionId,
        status: 'pending',
        requestPayload,
        attempts: 1,
      });
      expect(mockTransactionRepository.save).toHaveBeenCalledWith(mockTransaction);
    });
  });

  describe('When completing a transaction', () => {
    const transactionId = 'transaction-123';
    const orderId = 'order-123';
    const responsePayload = { result: { id: orderId } };
    const mockTransaction = {
      id: transactionId,
      status: 'completed',
      orderId,
      responsePayload,
    };

    it('Then should update the transaction status to completed', async () => {
      // Arrange
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      // Act
      const result = await service.completeTransaction(transactionId, orderId, responsePayload);

      // Assert
      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.createQueryBuilder).toHaveBeenCalled();
      expect(qb.update).toHaveBeenCalledWith(OrderTransactionEntity);
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          orderId,
          updatedAt: expect.any(Date),
        }),
      );
      expect(qb.where).toHaveBeenCalledWith('id = :id', {
        id: transactionId,
        responsePayload,
      });
      expect(qb.execute).toHaveBeenCalled();
    });
  });

  describe('When executing with idempotency', () => {
    const transactionId = 'transaction-123';
    const requestPayload = { userId: 'user-123', orderData: { items: [] } };
    const orderId = 'order-123';
    const mockResult = { id: orderId };
    const operation = jest.fn().mockResolvedValue(mockResult);

    it('Then should execute operation for new transaction', async () => {
      // Arrange
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.create.mockReturnValue({
        id: transactionId,
        status: 'pending',
        requestPayload,
      });
      mockTransactionRepository.save.mockResolvedValue({
        id: transactionId,
        status: 'pending',
        requestPayload,
      });
      const scopedQb = mockTransactionRepository.createQueryBuilder();

      // Act
      const result = await service.executeWithIdempotency(transactionId, requestPayload, operation);

      // Assert
      expect(result).toEqual(mockResult);
      expect(operation).toHaveBeenCalled();
      expect(mockTransactionRepository.createQueryBuilder).toHaveBeenCalled();
      expect(scopedQb.update).toHaveBeenCalledWith(OrderTransactionEntity);
      expect(scopedQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          orderId,
          updatedAt: expect.any(Date),
        }),
      );
      expect(scopedQb.where).toHaveBeenCalledWith(
        'id = :id',
        expect.objectContaining({ id: transactionId }),
      );
      expect(scopedQb.execute).toHaveBeenCalled();
    });

    it('Then should return existing result for completed transaction', async () => {
      // Arrange
      mockTransactionRepository.findOne.mockResolvedValue({
        id: transactionId,
        status: 'completed',
        orderId,
      });

      // Act
      const result = await service.executeWithIdempotency(transactionId, requestPayload, operation);

      // Assert
      expect(result).toEqual({ id: orderId });
      expect(operation).not.toHaveBeenCalled();
    });

    it('Then should increment attempt count for pending transaction', async () => {
      // Arrange
      mockTransactionRepository.findOne.mockResolvedValue({
        id: transactionId,
        status: 'pending',
      });
      mockTransactionRepository.increment.mockResolvedValue({ affected: 1 });

      // Act
      await service.executeWithIdempotency(transactionId, requestPayload, operation);

      // Assert
      expect(mockTransactionRepository.increment).toHaveBeenCalledWith(
        { id: transactionId },
        'attempts',
        1,
      );
      expect(operation).toHaveBeenCalled();
    });

    it('Then should handle operation failure', async () => {
      // Arrange
      const error = new Error('Operation failed');
      const failingOperation = jest.fn().mockRejectedValue(error);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionRepository.create.mockReturnValue({
        id: transactionId,
        status: 'pending',
        requestPayload,
      });
      mockTransactionRepository.save.mockResolvedValue({
        id: transactionId,
        status: 'pending',
        requestPayload,
      });

      // Act & Assert
      await expect(
        service.executeWithIdempotency(transactionId, requestPayload, failingOperation),
      ).rejects.toThrow('Operation failed');
      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        { id: transactionId },
        expect.objectContaining({
          status: 'failed',
          responsePayload: expect.objectContaining({
            error: 'Operation failed',
          }),
        }),
      );
    });
  });
});
