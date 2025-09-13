import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderTransactionEntity } from '../entities/order-transaction.entity';
import { TransactionService } from './transaction.service';

/**
 * Service for handling idempotent transactions
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(OrderTransactionEntity)
    private readonly transactionRepository: Repository<OrderTransactionEntity>,
    private readonly transactionService: TransactionService
  ) {}

  /**
   * Check if a transaction ID already exists
   * @param transactionId The transaction ID to check
   * @returns The existing transaction if found, null otherwise
   */
  async checkTransactionExists(transactionId: string): Promise<OrderTransactionEntity | null> {
    return this.transactionRepository.findOne({
      where: { id: transactionId }
    });
  }

  /**
   * Record a new transaction
   * @param transactionId The transaction ID
   * @param requestPayload The request payload
   * @returns The created transaction
   */
  async recordTransaction(
    transactionId: string,
    requestPayload: Record<string, unknown>
  ): Promise<OrderTransactionEntity> {
    const transaction = this.transactionRepository.create({
      id: transactionId,
      status: 'pending',
      requestPayload,
      attempts: 1
    });

    return this.transactionRepository.save(transaction);
  }

  /**
   * Complete a transaction
   * @param transactionId The transaction ID
   * @param orderId The order ID
   * @param responsePayload The response payload
   * @returns The updated transaction
   */
  async completeTransaction(
    transactionId: string,
    orderId: string,
    responsePayload?: Record<string, unknown>
  ): Promise<OrderTransactionEntity> {
    await this.transactionRepository.update(
      { id: transactionId },
      {
        status: 'completed',
        orderId,
        responsePayload,
        updatedAt: new Date()
      }
    );

    return this.checkTransactionExists(transactionId);
  }

  /**
   * Fail a transaction
   * @param transactionId The transaction ID
   * @param error The error that caused the failure
   * @returns The updated transaction
   */
  async failTransaction(
    transactionId: string,
    error: Error
  ): Promise<OrderTransactionEntity> {
    await this.transactionRepository.update(
      { id: transactionId },
      {
        status: 'failed',
        responsePayload: {
          error: error.message,
          stack: error.stack
        },
        updatedAt: new Date()
      }
    );

    return this.checkTransactionExists(transactionId);
  }

  /**
   * Increment the attempt count for a transaction
   * @param transactionId The transaction ID
   * @returns The updated transaction
   */
  async incrementAttempt(transactionId: string): Promise<OrderTransactionEntity> {
    await this.transactionRepository.increment(
      { id: transactionId },
      'attempts',
      1
    );

    return this.checkTransactionExists(transactionId);
  }

  /**
   * Execute a function with idempotency
   * @param transactionId The transaction ID
   * @param requestPayload The request payload
   * @param operation The function to execute
   * @returns The result of the operation
   */
  async executeWithIdempotency<T extends { id: string }>(
    transactionId: string,
    requestPayload: Record<string, unknown>,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check if transaction already exists
    const existingTransaction = await this.checkTransactionExists(transactionId);

    if (existingTransaction) {
      this.logger.log(`Transaction ${transactionId} already exists with status ${existingTransaction.status}`);

      // If transaction is completed, return the stored result
      if (existingTransaction.status === 'completed' && existingTransaction.orderId) {
        this.logger.log(`Returning existing result for transaction ${transactionId}`);
        
        // Cast to T since we know it's the same type
        return { id: existingTransaction.orderId } as T;
      }

      // If transaction is pending, increment attempt count
      if (existingTransaction.status === 'pending') {
        await this.incrementAttempt(transactionId);
      }
    } else {
      // Record new transaction
      await this.recordTransaction(transactionId, requestPayload);
    }

    try {
      // Execute operation
      const result = await operation();

      // Complete transaction
      await this.completeTransaction(
        transactionId,
        result.id,
        { result }
      );

      return result;
    } catch (error) {
      // Fail transaction
      await this.failTransaction(transactionId, error as Error);
      throw error;
    }
  }
}
