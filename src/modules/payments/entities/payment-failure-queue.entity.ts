import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Payment failure queue entity for manual intervention
 */
@Entity('payment_failure_queue')
export class PaymentFailureQueueEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'uuid' })
  @Index()
  readonly paymentId!: string;

  @Column({ type: 'uuid' })
  @Index()
  readonly orderId!: string;

  @Column({ type: 'varchar', length: 36 })
  readonly gatewayPaymentId!: string;

  @Column({ type: 'varchar', length: 36 })
  readonly idempotencyKey!: string;

  @Column({ type: 'integer' })
  readonly amount!: number;

  @Column({ type: 'varchar', length: 3 })
  readonly currency!: string;

  @Column({ type: 'varchar', length: 50 })
  readonly errorCode!: string;

  @Column({ type: 'varchar', length: 255 })
  readonly errorMessage!: string;

  @Column({ type: 'integer', default: 0 })
  readonly retryCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  readonly lastRetryAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  readonly nextRetryAt?: Date;

  @Column({ type: 'jsonb' })
  readonly paymentDetails!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  readonly gatewayResponse?: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  readonly resolved!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  readonly resolutionNotes?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  readonly resolvedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  readonly resolvedAt?: Date;

  @CreateDateColumn()
  readonly createdAt!: Date;

  @UpdateDateColumn()
  readonly updatedAt!: Date;
}
