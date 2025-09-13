import type { PaymentStatus } from '../interfaces/payment-gateway.interface';

/**
 * DTO for payment response
 */
export class PaymentResponseDto {
  /** Payment ID */
  readonly id!: string;
  
  /** Order ID */
  readonly orderId!: string;
  
  /** Success flag */
  readonly success!: boolean;
  
  /** Payment status */
  readonly status!: PaymentStatus;
  
  /** Payment amount in cents */
  readonly amount!: number;
  
  /** Currency code */
  readonly currency!: string;
  
  /** Error code (if any) */
  readonly errorCode?: string;
  
  /** Error message (if any) */
  readonly errorMessage?: string;
  
  /** Timestamp of the operation */
  readonly timestamp!: Date;
}
