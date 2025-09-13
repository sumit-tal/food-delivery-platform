import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseConnectionService } from './database-connection.service';

/**
 * Service for handling database transactions with proper isolation
 */
@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(private readonly databaseConnectionService: DatabaseConnectionService) {}

  /**
   * Execute a function within a transaction with SERIALIZABLE isolation level
   * @param operation The function to execute within the transaction
   * @returns The result of the operation
   */
  async executeInTransaction<T>(
    operation: (entityManager: EntityManager) => Promise<T>
  ): Promise<T> {
    // Get the data source from the database connection service
    const dataSource = this.databaseConnectionService.getDataSource();
    const queryRunner = dataSource.createQueryRunner();
    
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    
    try {
      const result = await operation(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Transaction failed: ${error.message}`);
      } else {
        this.logger.error('Transaction failed with unknown error');
      }
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute a function with retry logic for handling serialization failures
   * @param operation The function to execute with retries
   * @param maxRetries Maximum number of retry attempts
   * @returns The result of the operation
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let retries = 0;
    
    // Using a for loop instead of while(true) to avoid linting issues
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        // Check if it's a serialization failure (PostgreSQL error code 40001)
        let isSerializationFailure = false;
        
        if (typeof error === 'object' && error !== null) {
          if ('code' in error && error.code === '40001') {
            isSerializationFailure = true;
          } else if ('message' in error && typeof error.message === 'string' && 
                    error.message.includes('could not serialize access')) {
            isSerializationFailure = true;
          }
        }
        
        if (!isSerializationFailure || retries >= maxRetries) {
          throw error;
        }
        
        retries++;
        this.logger.warn(`Serialization failure, retrying (${retries}/${maxRetries})...`);
        
        // Exponential backoff with jitter
        const baseDelay = 100; // 100ms
        const maxDelay = 1000; // 1s
        const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
        const jitter = Math.random() * 0.3 * delay; // 30% jitter
        
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }
    
    // This should never be reached due to the throw in the catch block
    // but TypeScript requires a return statement
    throw new Error('Maximum retries exceeded');
  }

  /**
   * Generate a unique transaction ID for idempotency
   * @returns A UUID v4 string
   */
  generateTransactionId(): string {
    return uuidv4();
  }
}
