import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { RestaurantEntity } from './restaurant.entity';
import { MenuCategoryEntity } from './menu-category.entity';

/**
 * MenuItem entity for TypeORM persistence
 */
@Entity('menu_items')
export class MenuItemEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'uuid' })
  @Index()
  readonly restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, restaurant => restaurant.menuItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  readonly restaurant!: RestaurantEntity;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  readonly categoryId?: string;

  @ManyToOne(() => MenuCategoryEntity, category => category.menuItems, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  readonly category?: MenuCategoryEntity;

  @Column({ type: 'varchar', length: 255 })
  readonly name!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  readonly description?: string;

  @Column({ type: 'integer' })
  readonly priceCents!: number;

  @Column({ type: 'varchar', length: 3 })
  readonly currency!: string;

  @Column({ type: 'boolean', default: true })
  readonly isAvailable!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  readonly tags?: string[];

  @Column({ type: 'varchar', length: 1000, nullable: true })
  readonly imageUrl?: string;

  @Column({ type: 'integer' })
  readonly displayOrder!: number;
}
