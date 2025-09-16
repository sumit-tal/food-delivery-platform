import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { RestaurantEntity } from './restaurant.entity';
import { MenuCategoryEntity } from './menu-category.entity';

/**
 * MenuItem entity for TypeORM persistence
 */
@Entity('menu_items')
export class MenuItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, restaurant => restaurant.menuItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant!: RestaurantEntity;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  categoryId?: string;

  @ManyToOne(() => MenuCategoryEntity, category => category.menuItems, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category?: MenuCategoryEntity;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description?: string;

  @Column({ type: 'integer' })
  priceCents!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'boolean', default: true })
  isAvailable!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imageUrl?: string;

  @Column({ type: 'integer' })
  displayOrder!: number;
}
