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
  orderId?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ type: 'jsonb' })
  requestPayload!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  responsePayload?: Record<string, unknown>;

  @Column({ type: 'integer', default: 1 })
  attempts!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
