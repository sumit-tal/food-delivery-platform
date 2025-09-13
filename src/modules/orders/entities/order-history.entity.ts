import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { OrderStatus } from '../constants/order-status.enum';

/**
 * OrderHistory entity for TypeORM persistence
 * Tracks the history of status changes for an order
 */
@Entity('order_history')
export class OrderHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'uuid' })
  @Index()
  readonly orderId!: string;

  @Column({
    type: 'enum',
    enum: OrderStatus
  })
  readonly status!: OrderStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  readonly note?: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  readonly actorId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  readonly actorType?: string;

  @CreateDateColumn()
  @Index()
  readonly createdAt!: Date;
}
