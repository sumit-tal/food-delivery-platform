import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { PaymentStatus } from '../interfaces/payment-gateway.interface';

/**
 * Payment entity for TypeORM persistence
 */
@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'uuid' })
  @Index()
  readonly orderId!: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  @Index()
  readonly gatewayPaymentId!: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  @Index()
  readonly idempotencyKey!: string;

  @Column({ type: 'integer' })
  readonly amount!: number;

  @Column({ type: 'varchar', length: 3 })
  readonly currency!: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING
  })
  readonly status!: PaymentStatus;

  @Column({ type: 'jsonb', nullable: true })
  readonly paymentMethod!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  readonly gatewayResponse?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  readonly errorCode?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  readonly errorMessage?: string;

  @Column({ type: 'integer', default: 0 })
  readonly refundedAmount!: number;

  @Column({ type: 'jsonb', nullable: true })
  readonly metadata?: Record<string, unknown>;

  @CreateDateColumn()
  readonly createdAt!: Date;

  @UpdateDateColumn()
  readonly updatedAt!: Date;
}
