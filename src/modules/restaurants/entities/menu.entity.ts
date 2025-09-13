import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { RestaurantEntity } from './restaurant.entity';

/**
 * Menu entity for tracking menu versions
 */
@Entity('menus')
export class MenuEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'uuid' })
  @Index()
  readonly restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  readonly restaurant!: RestaurantEntity;

  @Column({ type: 'integer' })
  @Index()
  readonly version!: number;

  @Column({ type: 'boolean', default: true })
  readonly isActive!: boolean;

  @CreateDateColumn()
  readonly createdAt!: Date;
}
