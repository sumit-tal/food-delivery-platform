import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentGateway,
  PaymentDetails,
  PaymentResult,
  PaymentStatus,
} from '../interfaces/payment-gateway.interface';
import { CircuitBreakerService } from '../services/circuit-breaker.service';

/**
 * Circuit breaker wrapper for payment gateway
 * Adds circuit breaker protection to any payment gateway implementation
 */
@Injectable()
export class CircuitBreakerPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(CircuitBreakerPaymentGateway.name);

  constructor(
    private readonly paymentGateway: PaymentGateway,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /**
   * Authorize a payment with circuit breaker protection
   * @param paymentDetails The payment details
   * @returns The payment authorization result
   */
  async authorizePayment(paymentDetails: PaymentDetails): Promise<PaymentResult> {
    const circuitId = `payment-authorize-${paymentDetails.orderId}`;

    return this.circuitBreaker.executeWithCircuitBreaker<PaymentResult>(
      circuitId,
      () => this.paymentGateway.authorizePayment(paymentDetails),
      {
        fallback: this.createAuthorizeFallback(paymentDetails.orderId),
      },
    );
  }

  /**
   * Capture a payment with circuit breaker protection
   * @param paymentId The payment ID to capture
   * @param amount The amount to capture (optional)
   * @returns The payment capture result
   */
  async capturePayment(paymentId: string, amount?: number): Promise<PaymentResult> {
    const circuitId = `payment-capture-${paymentId}`;

    return this.circuitBreaker.executeWithCircuitBreaker<PaymentResult>(
      circuitId,
      () => this.paymentGateway.capturePayment(paymentId, amount),
      {
        fallback: this.createCaptureFallback(paymentId),
      },
    );
  }

  /**
   * Refund a payment with circuit breaker protection
   * @param paymentId The payment ID to refund
   * @param amount The amount to refund (optional)
   * @returns The payment refund result
   */
  async refundPayment(paymentId: string, amount?: number): Promise<PaymentResult> {
    const circuitId = `payment-refund-${paymentId}`;

    return this.circuitBreaker.executeWithCircuitBreaker<PaymentResult>(
      circuitId,
      () => this.paymentGateway.refundPayment(paymentId, amount),
      {
        fallback: this.createRefundFallback(paymentId),
      },
    );
  }

  /**
   * Void a payment with circuit breaker protection
   * @param paymentId The payment ID to void
   * @returns The payment void result
   */
  async voidPayment(paymentId: string): Promise<PaymentResult> {
    const circuitId = `payment-void-${paymentId}`;

    return this.circuitBreaker.executeWithCircuitBreaker<PaymentResult>(
      circuitId,
      () => this.paymentGateway.voidPayment(paymentId),
      {
        fallback: this.createVoidFallback(paymentId),
      },
    );
  }

  /**
   * Get payment status with circuit breaker protection
   * @param paymentId The payment ID to check
   * @returns The payment status result
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResult> {
    const circuitId = `payment-status-${paymentId}`;

    return this.circuitBreaker.executeWithCircuitBreaker<PaymentResult>(
      circuitId,
      () => this.paymentGateway.getPaymentStatus(paymentId),
      {
        // Status checks can use a different circuit breaker configuration
        // with shorter timeouts and more frequent retries
        resetTimeoutMs: 15000, // 15 seconds
        failureThreshold: 10, // More failures allowed for status checks
        fallback: this.createStatusFallback(paymentId),
      },
    );
  }

  /**
   * Create a fallback result when circuit is open
   * @param errorCode Error code
   * @param errorMessage Error message
   * @param paymentId Payment ID (if available)
   * @returns Fallback payment result
   */
  private createFallbackResult(
    errorCode: string,
    errorMessage: string,
    paymentId?: string,
  ): PaymentResult {
    this.logger.warn(`Using fallback for payment operation: ${errorMessage}`);

    const gatewayResponse = { error: { code: errorCode, message: errorMessage } };

    return {
      success: false,
      status: PaymentStatus.FAILED,
      errorCode,
      errorMessage,
      paymentId,
      timestamp: new Date(),
      gatewayResponse,
    };
  }

  /**
   * Create a fallback function for authorize payment
   * @param orderId Order ID
   * @returns Fallback function
   */
  private createAuthorizeFallback(orderId: string): <T>(error: Error) => T {
    return <T>(error: Error): T => {
      return this.createFallbackResult(
        'authorize_circuit_open',
        `Payment service unavailable: ${error.message}`,
        orderId,
      ) as unknown as T;
    };
  }

  /**
   * Create a fallback function for capture payment
   * @param paymentId Payment ID
   * @returns Fallback function
   */
  private createCaptureFallback(paymentId: string): <T>(error: Error) => T {
    return <T>(error: Error): T => {
      return this.createFallbackResult(
        'capture_circuit_open',
        `Payment service unavailable: ${error.message}`,
        paymentId,
      ) as unknown as T;
    };
  }

  /**
   * Create a fallback function for refund payment
   * @param paymentId Payment ID
   * @returns Fallback function
   */
  private createRefundFallback(paymentId: string): <T>(error: Error) => T {
    return <T>(error: Error): T => {
      return this.createFallbackResult(
        'refund_circuit_open',
        `Payment service unavailable: ${error.message}`,
        paymentId,
      ) as unknown as T;
    };
  }

  /**
   * Create a fallback function for void payment
   * @param paymentId Payment ID
   * @returns Fallback function
   */
  private createVoidFallback(paymentId: string): <T>(error: Error) => T {
    return <T>(error: Error): T => {
      return this.createFallbackResult(
        'void_circuit_open',
        `Payment service unavailable: ${error.message}`,
        paymentId,
      ) as unknown as T;
    };
  }

  /**
   * Create a fallback function for payment status
   * @param paymentId Payment ID
   * @returns Fallback function
   */
  private createStatusFallback(paymentId: string): <T>(error: Error) => T {
    return <T>(error: Error): T => {
      return this.createFallbackResult(
        'status_circuit_open',
        `Payment service unavailable: ${error.message}`,
        paymentId,
      ) as unknown as T;
    };
  }
}
