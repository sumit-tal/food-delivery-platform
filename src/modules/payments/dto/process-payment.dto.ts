import { IsNotEmpty, IsNumber, IsString, IsEmail, IsObject, IsOptional, Min } from 'class-validator';
import { PaymentMethodType } from '../interfaces/payment-gateway.interface';

/**
 * DTO for processing a payment
 */
export class ProcessPaymentDto {
  @IsNotEmpty()
  @IsString()
  readonly orderId!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  readonly amount!: number;

  @IsNotEmpty()
  @IsString()
  readonly currency!: string;

  @IsNotEmpty()
  @IsObject()
  readonly paymentMethod!: {
    type: PaymentMethodType;
    [key: string]: unknown;
  };

  @IsNotEmpty()
  @IsString()
  readonly customerId!: string;

  @IsNotEmpty()
  @IsEmail()
  readonly customerEmail!: string;

  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, unknown>;
}
