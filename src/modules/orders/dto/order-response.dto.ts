import { OrderStatus } from '../constants/order-status.enum';
import { PaymentStatus } from '../constants/payment-status.enum';

export class OrderItemResponseDto {
  readonly id!: string;
  readonly menuItemId!: string;
  readonly name!: string;
  readonly description?: string;
  readonly quantity!: number;
  readonly unitPriceCents!: number;
  readonly totalPriceCents!: number;
  readonly currency!: string;
  readonly customizations?: Record<string, unknown>;
}

export class OrderResponseDto {
  readonly id!: string;
  readonly userId!: string;
  readonly restaurantId!: string;
  readonly transactionId!: string;
  readonly status!: OrderStatus;
  readonly paymentStatus!: PaymentStatus;
  readonly subtotalCents!: number;
  readonly taxCents!: number;
  readonly deliveryFeeCents!: number;
  readonly tipCents!: number;
  readonly totalCents!: number;
  readonly currency!: string;
  readonly deliveryAddress?: string;
  readonly deliveryInstructions?: string;
  readonly estimatedDeliveryMinutes?: number;
  readonly driverId?: string;
  readonly createdAt!: Date;
  readonly updatedAt!: Date;
  readonly items!: OrderItemResponseDto[];
}
