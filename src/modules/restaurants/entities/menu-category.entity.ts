import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { RestaurantEntity } from './restaurant.entity';
import { MenuItemEntity } from './menu-item.entity';

/**
 * MenuCategory entity for organizing menu items
 */
@Entity('menu_categories')
export class MenuCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'varchar', length: 255 })
  readonly name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  readonly description?: string;

  @Column({ type: 'integer' })
  readonly displayOrder!: number;

  @Column({ type: 'boolean', default: true })
  readonly isActive!: boolean;

  @Column({ type: 'uuid' })
  @Index()
  readonly restaurantId!: string;

  @ManyToOne(() => RestaurantEntity, restaurant => restaurant.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  readonly restaurant!: RestaurantEntity;

  @OneToMany(() => MenuItemEntity, menuItem => menuItem.category)
  readonly menuItems!: MenuItemEntity[];
}
