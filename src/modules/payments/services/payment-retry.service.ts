import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { PaymentFailureQueueEntity } from '../entities/payment-failure-queue.entity';
import { PaymentEntity } from '../entities/payment.entity';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Initial delay in ms before first retry */
  initialDelayMs: number;

  /** Maximum delay in ms between retries */
  maxDelayMs: number;

  /** Multiplier for exponential backoff */
  backoffMultiplier: number;

  /** Random factor to add jitter to retry timing (0-1) */
  jitterFactor: number;
}

/**
 * Service for handling payment retry logic with exponential backoff
 */
@Injectable()
export class PaymentRetryService {
  private readonly logger = new Logger(PaymentRetryService.name);

  /** Default retry configuration */
  private readonly defaultConfig: RetryConfig = {
    maxRetries: 5,
    initialDelayMs: 1000, // 1 second
    maxDelayMs: 60000, // 1 minute
    backoffMultiplier: 2,
    jitterFactor: 0.2,
  };

  constructor(
    @InjectRepository(PaymentFailureQueueEntity)
    private readonly failureQueueRepository: Repository<PaymentFailureQueueEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /**
   * Add a failed payment to the retry queue
   * @param payment The failed payment entity
   * @param error The error that occurred
   * @param paymentDetails The original payment details
   * @param gatewayResponse The gateway response (if any)
   */
  async addToRetryQueue(
    payment: PaymentEntity,
    error: Error,
    paymentDetails: Record<string, unknown>,
    gatewayResponse?: Record<string, unknown>,
  ): Promise<PaymentFailureQueueEntity> {
    const failureQueueItem = this.failureQueueRepository.create({
      paymentId: payment.id,
      orderId: payment.orderId,
      gatewayPaymentId: payment.gatewayPaymentId,
      idempotencyKey: payment.idempotencyKey,
      amount: payment.amount,
      currency: payment.currency,
      errorCode: payment.errorCode || 'unknown_error',
      errorMessage: error.message,
      retryCount: 0,
      paymentDetails,
      gatewayResponse,
      nextRetryAt: this.calculateNextRetryTime(0),
    });

    return this.failureQueueRepository.save(failureQueueItem);
  }

  /**
   * Process items in the retry queue that are due for retry
   * @returns Number of items processed
   */
  async processRetryQueue(): Promise<number> {
    // Find items due for retry
    const itemsDueForRetry = await this.failureQueueRepository.find({
      where: {
        resolved: false,
        nextRetryAt: LessThanOrEqual(new Date()),
      },
      take: 10, // Process in batches
    });

    if (itemsDueForRetry.length === 0) {
      return 0;
    }

    this.logger.log(`Processing ${itemsDueForRetry.length} items in the payment retry queue`);

    let processedCount = 0;

    // Process each item
    for (const item of itemsDueForRetry) {
      try {
        // Check circuit breaker state
        const circuitState = this.circuitBreakerService.getCircuitState('payment-gateway');
        if (circuitState === 'open') {
          this.logger.warn(`Circuit breaker is open, skipping retry for payment ${item.paymentId}`);
          continue;
        }

        // Check if max retries reached
        if (item.retryCount >= this.defaultConfig.maxRetries) {
          this.logger.warn(
            `Max retries (${this.defaultConfig.maxRetries}) reached for payment ${item.paymentId}, moving to manual intervention`,
          );

          await this.failureQueueRepository.update(item.id, {
            retryCount: item.retryCount + 1,
            lastRetryAt: new Date(),
            nextRetryAt: null, // No more automatic retries
          });

          continue;
        }

        // TODO: Implement actual retry logic with payment gateway
        // This would call the payment gateway service to retry the payment

        // For now, just update the retry count and next retry time
        await this.failureQueueRepository.update(item.id, {
          retryCount: item.retryCount + 1,
          lastRetryAt: new Date(),
          nextRetryAt: this.calculateNextRetryTime(item.retryCount + 1),
        });

        processedCount++;
      } catch (error) {
        this.logger.error(
          `Error processing retry for payment ${item.paymentId}: ${(error as Error).message}`,
        );
      }
    }

    return processedCount;
  }

  /**
   * Mark a payment failure as resolved
   * @param failureId The ID of the failure queue item
   * @param notes Resolution notes
   * @param resolvedBy User who resolved the issue
   */
  async markAsResolved(
    failureId: string,
    notes: string,
    resolvedBy: string,
  ): Promise<PaymentFailureQueueEntity> {
    await this.failureQueueRepository.update(failureId, {
      resolved: true,
      resolutionNotes: notes,
      resolvedBy,
      resolvedAt: new Date(),
    });

    const updated = await this.failureQueueRepository.findOne({
      where: { id: failureId },
    });

    if (!updated) {
      throw new NotFoundException(`Payment failure queue item not found for id: ${failureId}`);
    }

    return updated;
  }

  /**
   * Get pending items in the failure queue
   * @param limit Maximum number of items to return
   * @returns List of pending failure queue items
   */
  async getPendingFailures(limit = 50): Promise<PaymentFailureQueueEntity[]> {
    return this.failureQueueRepository.find({
      where: { resolved: false },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Calculate the next retry time using exponential backoff with jitter
   * @param retryCount Current retry count
   * @returns Date for next retry
   */
  private calculateNextRetryTime(retryCount: number): Date {
    // Calculate delay with exponential backoff
    const exponentialDelay =
      this.defaultConfig.initialDelayMs *
      Math.pow(this.defaultConfig.backoffMultiplier, retryCount);

    // Apply maximum delay cap
    const cappedDelay = Math.min(exponentialDelay, this.defaultConfig.maxDelayMs);

    // Add jitter to prevent thundering herd problem
    const jitter = cappedDelay * this.defaultConfig.jitterFactor * (Math.random() * 2 - 1);
    const finalDelay = Math.max(0, cappedDelay + jitter);

    // Calculate next retry time
    const nextRetryTime = new Date();
    nextRetryTime.setTime(nextRetryTime.getTime() + finalDelay);

    return nextRetryTime;
  }
}
