import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { MenuItemEntity } from './menu-item.entity';

/**
 * Restaurant entity for TypeORM persistence
 */
@Entity('restaurants')
export class RestaurantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  slug!: string;

  @Column({ type: 'simple-array' })
  cuisineTypes!: string[];

  @Column({ type: 'varchar', length: 100 })
  @Index()
  city!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  area?: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  isOpen!: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rating?: number;

  @Column({ type: 'integer', nullable: true })
  etaMin?: number;

  @Column({ type: 'integer', nullable: true })
  etaMax?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => MenuItemEntity, menuItem => menuItem.restaurant)
  menuItems!: MenuItemEntity[];
}
