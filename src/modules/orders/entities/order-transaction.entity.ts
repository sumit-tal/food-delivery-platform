import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * OrderTransaction entity for TypeORM persistence
 * Used for tracking transaction idempotency
 */
@Entity('order_transactions')
export class OrderTransactionEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  readonly id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  readonly orderId?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  readonly status!: string;

  @Column({ type: 'jsonb' })
  readonly requestPayload!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  readonly responsePayload?: Record<string, unknown>;

  @Column({ type: 'integer', default: 1 })
  readonly attempts!: number;

  @CreateDateColumn()
  readonly createdAt!: Date;

  @UpdateDateColumn()
  readonly updatedAt!: Date;
}
