import { IsUUID } from 'class-validator';

/**
 * DTO for customer tracking subscriptions
 */
export class TrackingSubscriptionDto {
  @IsUUID()
  readonly orderId!: string;
}
