import { IsNotEmpty, IsNumber, IsString, IsOptional, Min } from 'class-validator';

/**
 * DTO for refunding a payment
 */
export class RefundPaymentDto {
  @IsNotEmpty()
  @IsString()
  readonly paymentId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  readonly amount?: number;

  @IsOptional()
  @IsString()
  readonly reason?: string;
}
