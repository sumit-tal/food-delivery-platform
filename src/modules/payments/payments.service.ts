import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentFailureQueueEntity } from './entities/payment-failure-queue.entity';
import { 
  PaymentGateway, 
  PaymentDetails, 
  PaymentResult, 
  PaymentStatus 
} from './interfaces/payment-gateway.interface';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { PaymentRetryService } from './services/payment-retry.service';
import { PaymentCacheService } from './services/payment-cache.service';
import { IdempotencyService } from '../orders/services/idempotency.service';
import { OrdersService } from '../orders/orders.service';

/**
 * Service for handling payment processing
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @Inject('PaymentGateway')
    private readonly paymentGateway: PaymentGateway,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly paymentRetryService: PaymentRetryService,
    private readonly paymentCacheService: PaymentCacheService,
    private readonly idempotencyService: IdempotencyService,
    private readonly ordersService: OrdersService
  ) {}

  /**
   * Process a payment for an order
   * @param orderId The order ID
   * @param amount The payment amount in cents
   * @param currency The currency code
   * @param paymentMethod The payment method details
   * @param customerId The customer ID
   * @param customerEmail The customer email
   * @param metadata Additional metadata
   * @returns The payment result
   */
  async processPayment(
    orderId: string,
    amount: number,
    currency: string,
    paymentMethod: Record<string, unknown>,
    customerId: string,
    customerEmail: string,
    metadata?: Record<string, unknown>
  ): Promise<PaymentResult> {
    // Generate idempotency key
    const idempotencyKey = uuidv4();

    // Create payment details
    const paymentDetails: PaymentDetails = {
      orderId,
      amount,
      currency,
      paymentMethod: {
        type: paymentMethod.type as any,
        details: paymentMethod
      },
      customer: {
        id: customerId,
        email: customerEmail
      },
      idempotencyKey,
      metadata
    };

    // Check for cached response (duplicate request)
    const cachedResult = this.paymentCacheService.get(idempotencyKey);
    if (cachedResult) {
      this.logger.log(`Returning cached payment result for idempotency key ${idempotencyKey}`);
      return cachedResult;
    }

    // Ensure order exists and is in a valid state before payment
    await this.ensureValidOrderState(orderId);

    try {
      // Process payment with circuit breaker protection
      const result = await this.circuitBreakerService.executeWithCircuitBreaker(
        'payment-gateway',
        async () => {
          // Execute the payment with idempotency check
          return this.idempotencyService.executeWithIdempotency(
            idempotencyKey,
            paymentDetails,
            async () => {
              // Authorize payment
              const authResult = await this.paymentGateway.authorizePayment(paymentDetails);

              // Store payment record
              const payment = await this.createPaymentRecord(
                orderId,
                authResult.paymentId,
                idempotencyKey,
                amount,
                currency,
                authResult.status,
                paymentMethod,
                authResult.gatewayResponse,
                authResult.errorCode,
                authResult.errorMessage
              );

              // If payment was successful, capture it
              if (authResult.success && authResult.status === PaymentStatus.AUTHORIZED) {
                const captureResult = await this.paymentGateway.capturePayment(authResult.paymentId);

                // Update payment record with capture result
                await this.updatePaymentRecord(
                  payment.id,
                  captureResult.status,
                  captureResult.gatewayResponse,
                  captureResult.errorCode,
                  captureResult.errorMessage
                );

                // Return the capture result
                return {
                  id: payment.id,
                  ...captureResult
                };
              }

              // Return the authorization result
              return {
                id: payment.id,
                ...authResult
              };
            }
          );
        }
      );

      // Cache the successful result
      if (result.success) {
        this.paymentCacheService.set(idempotencyKey, result);
      } else {
        // Handle failed payment
        await this.handleFailedPayment(result);
      }

      return result;
    } catch (error) {
      this.logger.error(`Payment processing error: ${error.message}`, error.stack);
      
      // Create a failure result
      const failureResult: PaymentResult = {
        success: false,
        status: PaymentStatus.FAILED,
        errorCode: 'payment_processing_error',
        errorMessage: error.message,
        timestamp: new Date()
      };

      // Handle failed payment
      await this.handleFailedPayment(failureResult, error);

      return failureResult;
    }
  }

  /**
   * Get payment by ID
   * @param paymentId The payment ID
   * @returns The payment entity
   */
  async getPaymentById(paymentId: string): Promise<PaymentEntity> {
    return this.paymentRepository.findOne({
      where: { id: paymentId }
    });
  }

  /**
   * Get payments for an order
   * @param orderId The order ID
   * @returns List of payment entities
   */
  async getPaymentsByOrderId(orderId: string): Promise<PaymentEntity[]> {
    return this.paymentRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Refund a payment
   * @param paymentId The payment ID
   * @param amount The amount to refund (optional, defaults to full amount)
   * @returns The refund result
   */
  async refundPayment(paymentId: string, amount?: number): Promise<PaymentResult> {
    // Get payment record
    const payment = await this.getPaymentById(paymentId);
    
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    // Check if payment is in a refundable state
    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new Error(`Payment ${paymentId} is in ${payment.status} state, not CAPTURED`);
    }

    try {
      // Process refund with circuit breaker protection
      const result = await this.circuitBreakerService.executeWithCircuitBreaker(
        'payment-gateway',
        async () => {
          // Refund payment
          return this.paymentGateway.refundPayment(payment.gatewayPaymentId, amount);
        }
      );

      // Update payment record with refund result
      await this.updatePaymentRecord(
        payment.id,
        result.status,
        result.gatewayResponse,
        result.errorCode,
        result.errorMessage,
        amount || payment.amount
      );

      return result;
    } catch (error) {
      this.logger.error(`Refund processing error: ${error.message}`, error.stack);
      
      // Create a failure result
      return {
        success: false,
        status: PaymentStatus.FAILED,
        errorCode: 'refund_processing_error',
        errorMessage: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Create a payment record
   * @param orderId The order ID
   * @param gatewayPaymentId The gateway payment ID
   * @param idempotencyKey The idempotency key
   * @param amount The payment amount
   * @param currency The currency code
   * @param status The payment status
   * @param paymentMethod The payment method details
   * @param gatewayResponse The gateway response
   * @param errorCode The error code (if any)
   * @param errorMessage The error message (if any)
   * @returns The created payment entity
   */
  private async createPaymentRecord(
    orderId: string,
    gatewayPaymentId: string,
    idempotencyKey: string,
    amount: number,
    currency: string,
    status: PaymentStatus,
    paymentMethod: Record<string, unknown>,
    gatewayResponse?: Record<string, unknown>,
    errorCode?: string,
    errorMessage?: string
  ): Promise<PaymentEntity> {
    const payment = this.paymentRepository.create({
      orderId,
      gatewayPaymentId,
      idempotencyKey,
      amount,
      currency,
      status,
      paymentMethod,
      gatewayResponse,
      errorCode,
      errorMessage
    });

    return this.paymentRepository.save(payment);
  }

  /**
   * Update a payment record
   * @param paymentId The payment ID
   * @param status The new payment status
   * @param gatewayResponse The gateway response
   * @param errorCode The error code (if any)
   * @param errorMessage The error message (if any)
   * @param refundedAmount The refunded amount (if applicable)
   * @returns The updated payment entity
   */
  private async updatePaymentRecord(
    paymentId: string,
    status: PaymentStatus,
    gatewayResponse?: Record<string, unknown>,
    errorCode?: string,
    errorMessage?: string,
    refundedAmount?: number
  ): Promise<PaymentEntity> {
    const updateData: Partial<PaymentEntity> = {
      status,
      gatewayResponse,
      errorCode,
      errorMessage
    };

    if (refundedAmount !== undefined) {
      updateData.refundedAmount = refundedAmount;
    }

    await this.paymentRepository.update(paymentId, updateData);

    return this.getPaymentById(paymentId);
  }

  /**
   * Handle a failed payment
   * @param result The payment result
   * @param error The error that occurred (if any)
   */
  private async handleFailedPayment(result: PaymentResult, error?: Error): Promise<void> {
    // Get payment record if available
    const payment = result.paymentId 
      ? await this.getPaymentById(result.paymentId)
      : null;

    if (!payment) {
      this.logger.warn('Cannot handle failed payment: payment record not found');
      return;
    }

    // Add to retry queue
    await this.paymentRetryService.addToRetryQueue(
      payment,
      error || new Error(result.errorMessage || 'Unknown payment error'),
      {
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        idempotencyKey: payment.idempotencyKey
      },
      result.gatewayResponse
    );

    this.logger.log(`Added failed payment ${payment.id} to retry queue`);
  }

  /**
   * Ensure order is in a valid state before payment
   * @param orderId The order ID
   * @throws Error if order is not in a valid state
   */
  private async ensureValidOrderState(orderId: string): Promise<void> {
    // Get order
    const order = await this.ordersService.getOrderById(orderId);
    
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Check if order is in a valid state for payment
    // This would depend on your order status flow
    // For now, we'll just check if it exists
    
    this.logger.log(`Order ${orderId} validated for payment processing`);
  }
}
