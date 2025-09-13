import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from '../src/modules/orders/services/transaction.service';
import { DatabaseConnectionService } from '../src/modules/orders/services/database-connection.service';

describe('When using TransactionService', () => {
  let service: TransactionService;
  let databaseConnectionService: DatabaseConnectionService;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    manager: {},
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockDatabaseConnectionService = {
    getDataSource: jest.fn().mockReturnValue(mockDataSource),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: DatabaseConnectionService,
          useValue: mockDatabaseConnectionService,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    databaseConnectionService = module.get<DatabaseConnectionService>(DatabaseConnectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When executing in transaction', () => {
    it('Then should execute operation in transaction and commit', async () => {
      // Arrange
      const operation = jest.fn().mockResolvedValue('result');

      // Act
      const result = await service.executeInTransaction(operation);

      // Assert
      expect(result).toBe('result');
      expect(mockDatabaseConnectionService.getDataSource).toHaveBeenCalled();
      expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalledWith('SERIALIZABLE');
      expect(operation).toHaveBeenCalledWith(mockQueryRunner.manager);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('Then should rollback transaction on error', async () => {
      // Arrange
      const error = new Error('Transaction failed');
      const operation = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(service.executeInTransaction(operation)).rejects.toThrow('Transaction failed');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('When executing with retry', () => {
    it('Then should execute operation successfully on first try', async () => {
      // Arrange
      const operation = jest.fn().mockResolvedValue('result');

      // Act
      const result = await service.executeWithRetry(operation);

      // Assert
      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('Then should retry on serialization failure', async () => {
      // Arrange
      const error = new Error('could not serialize access');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('result');

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return null as any;
      });

      // Act
      const result = await service.executeWithRetry(operation, 3);

      // Assert
      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('Then should retry on PostgreSQL serialization error code', async () => {
      // Arrange
      const error = { code: '40001', message: 'serialization failure' };
      const operation = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('result');

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return null as any;
      });

      // Act
      const result = await service.executeWithRetry(operation, 3);

      // Assert
      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('Then should throw error after max retries', async () => {
      // Arrange
      const error = new Error('could not serialize access');
      const operation = jest.fn().mockRejectedValue(error);

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return null as any;
      });

      // Act & Assert
      await expect(service.executeWithRetry(operation, 3)).rejects.toThrow(
        'could not serialize access'
      );
      expect(operation).toHaveBeenCalledTimes(4); // Initial attempt + 3 retries
    });

    it('Then should not retry on non-serialization errors', async () => {
      // Arrange
      const error = new Error('other error');
      const operation = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(service.executeWithRetry(operation, 3)).rejects.toThrow('other error');
      expect(operation).toHaveBeenCalledTimes(1); // Only the initial attempt
    });
  });

  describe('When generating transaction ID', () => {
    it('Then should generate a valid UUID', () => {
      // Act
      const transactionId = service.generateTransactionId();

      // Assert
      expect(transactionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });
});
