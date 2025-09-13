import { Injectable, Logger } from '@nestjs/common';
import { 
  PaymentGateway, 
  PaymentDetails, 
  PaymentResult, 
  PaymentStatus 
} from '../interfaces/payment-gateway.interface';

/**
 * Mock payment gateway implementation for testing
 * Simulates real payment gateway behavior including failures
 */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(MockPaymentGateway.name);
  
  // In-memory storage for payment data
  private readonly payments: Map<string, MockPaymentData> = new Map();
  
  // Failure simulation settings
  private failureRate = 0.1; // 10% of requests will fail
  private networkErrorRate = 0.05; // 5% of requests will have network errors
  private slowResponseRate = 0.1; // 10% of requests will be slow

  /**
   * Authorize a payment (reserve funds but don't capture)
   * @param paymentDetails The payment details
   * @returns The payment authorization result
   */
  async authorizePayment(paymentDetails: PaymentDetails): Promise<PaymentResult> {
    this.logger.log(`Authorizing payment for order ${paymentDetails.orderId}`);
    
    // Simulate processing delay
    await this.simulateProcessingDelay();
    
    // Check for simulated network error
    if (this.shouldSimulateNetworkError()) {
      throw new Error('Network error connecting to payment gateway');
    }
    
    // Check for simulated payment failure
    const shouldFail = this.shouldSimulateFailure();
    
    // Generate a unique payment ID
    const paymentId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Create payment result
    const result: PaymentResult = shouldFail 
      ? this.createFailureResult('card_declined', 'The card was declined')
      : this.createSuccessResult(paymentId, PaymentStatus.AUTHORIZED);
    
    // Store payment data if successful
    if (result.success) {
      this.payments.set(paymentId, {
        paymentId,
        details: paymentDetails,
        status: PaymentStatus.AUTHORIZED,
        amount: paymentDetails.amount,
        capturedAmount: 0,
        refundedAmount: 0,
        createdAt: new Date()
      });
    }
    
    return result;
  }

  /**
   * Capture a previously authorized payment
   * @param paymentId The payment ID to capture
   * @param amount The amount to capture (optional, defaults to full amount)
   * @returns The payment capture result
   */
  async capturePayment(paymentId: string, amount?: number): Promise<PaymentResult> {
    this.logger.log(`Capturing payment ${paymentId}`);
    
    // Simulate processing delay
    await this.simulateProcessingDelay();
    
    // Check for simulated network error
    if (this.shouldSimulateNetworkError()) {
      throw new Error('Network error connecting to payment gateway');
    }
    
    // Get payment data
    const paymentData = this.payments.get(paymentId);
    
    // Check if payment exists
    if (!paymentData) {
      return this.createFailureResult('payment_not_found', `Payment ${paymentId} not found`);
    }
    
    // Check if payment is in correct state
    if (paymentData.status !== PaymentStatus.AUTHORIZED) {
      return this.createFailureResult(
        'invalid_payment_state', 
        `Payment ${paymentId} is in ${paymentData.status} state, not AUTHORIZED`
      );
    }
    
    // Determine capture amount
    const captureAmount = amount || paymentData.amount;
    
    // Check if capture amount is valid
    if (captureAmount <= 0 || captureAmount > paymentData.amount) {
      return this.createFailureResult(
        'invalid_amount', 
        `Invalid capture amount: ${captureAmount}`
      );
    }
    
    // Check for simulated payment failure
    const shouldFail = this.shouldSimulateFailure();
    
    if (shouldFail) {
      return this.createFailureResult('capture_failed', 'Failed to capture payment');
    }
    
    // Update payment data
    paymentData.status = PaymentStatus.CAPTURED;
    paymentData.capturedAmount = captureAmount;
    
    return this.createSuccessResult(paymentId, PaymentStatus.CAPTURED);
  }

  /**
   * Refund a payment
   * @param paymentId The payment ID to refund
   * @param amount The amount to refund (optional, defaults to full amount)
   * @returns The payment refund result
   */
  async refundPayment(paymentId: string, amount?: number): Promise<PaymentResult> {
    this.logger.log(`Refunding payment ${paymentId}`);
    
    // Simulate processing delay
    await this.simulateProcessingDelay();
    
    // Check for simulated network error
    if (this.shouldSimulateNetworkError()) {
      throw new Error('Network error connecting to payment gateway');
    }
    
    // Get payment data
    const paymentData = this.payments.get(paymentId);
    
    // Check if payment exists
    if (!paymentData) {
      return this.createFailureResult('payment_not_found', `Payment ${paymentId} not found`);
    }
    
    // Check if payment is in correct state
    if (paymentData.status !== PaymentStatus.CAPTURED) {
      return this.createFailureResult(
        'invalid_payment_state', 
        `Payment ${paymentId} is in ${paymentData.status} state, not CAPTURED`
      );
    }
    
    // Determine refund amount
    const refundAmount = amount || paymentData.capturedAmount;
    
    // Check if refund amount is valid
    if (refundAmount <= 0 || refundAmount > paymentData.capturedAmount) {
      return this.createFailureResult(
        'invalid_amount', 
        `Invalid refund amount: ${refundAmount}`
      );
    }
    
    // Check for simulated payment failure
    const shouldFail = this.shouldSimulateFailure();
    
    if (shouldFail) {
      return this.createFailureResult('refund_failed', 'Failed to process refund');
    }
    
    // Update payment data
    paymentData.refundedAmount += refundAmount;
    
    // Update status based on refund amount
    if (paymentData.refundedAmount >= paymentData.capturedAmount) {
      paymentData.status = PaymentStatus.REFUNDED;
    } else {
      paymentData.status = PaymentStatus.PARTIALLY_REFUNDED;
    }
    
    return this.createSuccessResult(paymentId, paymentData.status);
  }

  /**
   * Void/cancel a payment authorization
   * @param paymentId The payment ID to void
   * @returns The payment void result
   */
  async voidPayment(paymentId: string): Promise<PaymentResult> {
    this.logger.log(`Voiding payment ${paymentId}`);
    
    // Simulate processing delay
    await this.simulateProcessingDelay();
    
    // Check for simulated network error
    if (this.shouldSimulateNetworkError()) {
      throw new Error('Network error connecting to payment gateway');
    }
    
    // Get payment data
    const paymentData = this.payments.get(paymentId);
    
    // Check if payment exists
    if (!paymentData) {
      return this.createFailureResult('payment_not_found', `Payment ${paymentId} not found`);
    }
    
    // Check if payment is in correct state
    if (paymentData.status !== PaymentStatus.AUTHORIZED) {
      return this.createFailureResult(
        'invalid_payment_state', 
        `Payment ${paymentId} is in ${paymentData.status} state, not AUTHORIZED`
      );
    }
    
    // Check for simulated payment failure
    const shouldFail = this.shouldSimulateFailure();
    
    if (shouldFail) {
      return this.createFailureResult('void_failed', 'Failed to void payment');
    }
    
    // Update payment data
    paymentData.status = PaymentStatus.VOIDED;
    
    return this.createSuccessResult(paymentId, PaymentStatus.VOIDED);
  }

  /**
   * Get payment status
   * @param paymentId The payment ID to check
   * @returns The payment status result
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResult> {
    this.logger.log(`Getting status for payment ${paymentId}`);
    
    // Simulate processing delay (shorter for status check)
    await this.simulateProcessingDelay(true);
    
    // Check for simulated network error
    if (this.shouldSimulateNetworkError()) {
      throw new Error('Network error connecting to payment gateway');
    }
    
    // Get payment data
    const paymentData = this.payments.get(paymentId);
    
    // Check if payment exists
    if (!paymentData) {
      return this.createFailureResult('payment_not_found', `Payment ${paymentId} not found`);
    }
    
    return this.createSuccessResult(paymentId, paymentData.status);
  }

  /**
   * Configure failure simulation rates
   * @param failureRate Percentage of requests that will fail (0-1)
   * @param networkErrorRate Percentage of requests that will have network errors (0-1)
   * @param slowResponseRate Percentage of requests that will be slow (0-1)
   */
  configureFailureSimulation(
    failureRate: number,
    networkErrorRate: number,
    slowResponseRate: number
  ): void {
    this.failureRate = Math.max(0, Math.min(1, failureRate));
    this.networkErrorRate = Math.max(0, Math.min(1, networkErrorRate));
    this.slowResponseRate = Math.max(0, Math.min(1, slowResponseRate));
    
    this.logger.log(
      `Configured failure simulation: failure=${this.failureRate}, ` +
      `network=${this.networkErrorRate}, slow=${this.slowResponseRate}`
    );
  }

  /**
   * Create a success payment result
   * @param paymentId The payment ID
   * @param status The payment status
   * @returns A successful payment result
   */
  private createSuccessResult(paymentId: string, status: PaymentStatus): PaymentResult {
    return {
      success: true,
      paymentId,
      status,
      timestamp: new Date(),
      gatewayResponse: {
        transaction_id: paymentId,
        status: status.toLowerCase(),
        processor_response_code: '1000',
        processor_response_text: 'Approved'
      }
    };
  }

  /**
   * Create a failure payment result
   * @param errorCode The error code
   * @param errorMessage The error message
   * @returns A failed payment result
   */
  private createFailureResult(errorCode: string, errorMessage: string): PaymentResult {
    return {
      success: false,
      status: PaymentStatus.FAILED,
      errorCode,
      errorMessage,
      timestamp: new Date(),
      gatewayResponse: {
        error: {
          code: errorCode,
          message: errorMessage
        }
      }
    };
  }

  /**
   * Simulate processing delay
   * @param isStatusCheck Whether this is a status check (faster)
   */
  private async simulateProcessingDelay(isStatusCheck = false): Promise<void> {
    const isSlow = this.shouldSimulateSlow();
    
    // Status checks are faster
    const baseDelay = isStatusCheck ? 50 : 200;
    
    // Slow responses take 2-5 seconds
    const delay = isSlow ? baseDelay * 10 + Math.random() * 3000 : baseDelay;
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Determine if we should simulate a payment failure
   * @returns True if should simulate failure
   */
  private shouldSimulateFailure(): boolean {
    return Math.random() < this.failureRate;
  }

  /**
   * Determine if we should simulate a network error
   * @returns True if should simulate network error
   */
  private shouldSimulateNetworkError(): boolean {
    return Math.random() < this.networkErrorRate;
  }

  /**
   * Determine if we should simulate a slow response
   * @returns True if should simulate slow response
   */
  private shouldSimulateSlow(): boolean {
    return Math.random() < this.slowResponseRate;
  }
}

/**
 * Mock payment data interface
 */
interface MockPaymentData {
  /** Payment ID */
  paymentId: string;
  
  /** Payment details */
  details: PaymentDetails;
  
  /** Current payment status */
  status: PaymentStatus;
  
  /** Total payment amount */
  amount: number;
  
  /** Amount captured */
  capturedAmount: number;
  
  /** Amount refunded */
  refundedAmount: number;
  
  /** Payment creation timestamp */
  createdAt: Date;
}
