import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { OrderEntity } from './order.entity';

/**
 * OrderItem entity for TypeORM persistence
 * Represents an individual item in a customer order
 */
@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'uuid' })
  @Index()
  readonly orderId!: string;

  @ManyToOne(() => OrderEntity, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  readonly order!: OrderEntity;

  @Column({ type: 'uuid' })
  readonly menuItemId!: string;

  @Column({ type: 'varchar', length: 255 })
  readonly name!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  readonly description?: string;

  @Column({ type: 'integer' })
  readonly quantity!: number;

  @Column({ type: 'integer' })
  readonly unitPriceCents!: number;

  @Column({ type: 'integer' })
  readonly totalPriceCents!: number;

  @Column({ type: 'varchar', length: 3 })
  readonly currency!: string;

  @Column({ type: 'jsonb', nullable: true })
  readonly customizations?: Record<string, unknown>;
}
