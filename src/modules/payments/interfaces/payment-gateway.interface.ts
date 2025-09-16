/**
 * Interface for payment gateway implementations
 */
export interface PaymentGateway {
  /**
   * Authorize a payment (reserve funds but don't capture)
   * @param paymentDetails The payment details
   * @returns The payment authorization result
   */
  authorizePayment(paymentDetails: PaymentDetails): Promise<PaymentResult>;
  
  /**
   * Capture a previously authorized payment
   * @param paymentId The payment ID to capture
   * @param amount The amount to capture (optional, defaults to full amount)
   * @returns The payment capture result
   */
  capturePayment(paymentId: string, amount?: number): Promise<PaymentResult>;
  
  /**
   * Refund a payment
   * @param paymentId The payment ID to refund
   * @param amount The amount to refund (optional, defaults to full amount)
   * @returns The payment refund result
   */
  refundPayment(paymentId: string, amount?: number): Promise<PaymentResult>;
  
  /**
   * Void/cancel a payment authorization
   * @param paymentId The payment ID to void
   * @returns The payment void result
   */
  voidPayment(paymentId: string): Promise<PaymentResult>;
  
  /**
   * Get payment status
   * @param paymentId The payment ID to check
   * @returns The payment status result
   */
  getPaymentStatus(paymentId: string): Promise<PaymentResult>;
}

/**
 * Payment details interface
 */
export interface PaymentDetails {
  /** Unique order ID */
  orderId: string;
  
  /** Payment amount in cents */
  amount: number;
  
  /** Currency code (ISO 4217) */
  currency: string;
  
  /** Payment method details */
  paymentMethod: PaymentMethod;
  
  /** Customer information */
  customer: CustomerInfo;
  
  /** Idempotency key to prevent duplicate payments */
  idempotencyKey: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Payment method interface
 */
export interface PaymentMethod {
  /** Payment method type */
  type: PaymentMethodType;
  
  /** Payment method details (card, bank account, etc.) */
  details: Record<string, unknown>;
}

/**
 * Customer information interface
 */
export interface CustomerInfo {
  /** Customer ID */
  id: string;
  
  /** Customer email */
  email: string;
  
  /** Customer IP address */
  ipAddress?: string;
  
  /** Customer billing address */
  billingAddress?: Address;
}

/**
 * Address interface
 */
export interface Address {
  /** Street address line 1 */
  line1: string;
  
  /** Street address line 2 (optional) */
  line2?: string;
  
  /** City */
  city: string;
  
  /** State/province/region */
  state: string;
  
  /** Postal/ZIP code */
  postalCode: string;
  
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
}

/**
 * Payment method types
 */
export enum PaymentMethodType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  DIGITAL_WALLET = 'digital_wallet'
}

/**
 * Payment result interface
 */
export interface PaymentResult {
  /** Success flag */
  success: boolean;
  
  /** Internal payment ID */
  id?: string;
  
  /** Payment gateway's reference ID */
  paymentId?: string;
  
  /** Payment status */
  status?: PaymentStatus;
  
  /** Error code (if any) */
  errorCode?: string;
  
  /** Error message (if any) */
  errorMessage?: string;
  
  /** Raw response from the payment gateway */
  gatewayResponse?: Record<string, unknown>;
  
  /** Timestamp of the operation */
  timestamp: Date;
}

/**
 * Payment status enum
 */
export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  VOIDED = 'voided'
}
