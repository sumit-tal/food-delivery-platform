import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { OrderItemEntity } from './order-item.entity';
import { OrderStatus } from '../constants/order-status.enum';
import { PaymentStatus } from '../constants/payment-status.enum';

/**
 * Order entity for TypeORM persistence
 * Represents a customer order with transaction isolation
 */
@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'uuid' })
  @Index()
  readonly userId!: string;

  @Column({ type: 'uuid' })
  @Index()
  readonly restaurantId!: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  @Index()
  readonly transactionId!: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.CREATED
  })
  @Index()
  readonly status!: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING
  })
  readonly paymentStatus!: PaymentStatus;

  @Column({ type: 'integer' })
  readonly subtotalCents!: number;

  @Column({ type: 'integer' })
  readonly taxCents!: number;

  @Column({ type: 'integer' })
  readonly deliveryFeeCents!: number;

  @Column({ type: 'integer' })
  readonly tipCents!: number;

  @Column({ type: 'integer' })
  readonly totalCents!: number;

  @Column({ type: 'varchar', length: 3 })
  readonly currency!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  readonly deliveryAddress?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  readonly deliveryInstructions?: string;

  @Column({ type: 'integer', nullable: true })
  readonly estimatedDeliveryMinutes?: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  readonly driverId?: string;

  @Column({ type: 'jsonb', nullable: true })
  readonly metadata?: Record<string, unknown>;

  @Column({ type: 'integer', default: 0 })
  readonly shardKey!: number;

  @CreateDateColumn()
  readonly createdAt!: Date;

  @UpdateDateColumn()
  readonly updatedAt!: Date;

  @OneToMany(() => OrderItemEntity, orderItem => orderItem.order, { cascade: true })
  readonly items!: OrderItemEntity[];
}
