import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { MenuItemEntity } from './menu-item.entity';

/**
 * Restaurant entity for TypeORM persistence
 */
@Entity('restaurants')
export class RestaurantEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'varchar', length: 255 })
  readonly name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  readonly slug!: string;

  @Column({ type: 'simple-array' })
  readonly cuisineTypes!: string[];

  @Column({ type: 'varchar', length: 100 })
  @Index()
  readonly city!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  readonly area?: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  readonly isOpen!: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  readonly rating?: number;

  @Column({ type: 'integer', nullable: true })
  readonly etaMin?: number;

  @Column({ type: 'integer', nullable: true })
  readonly etaMax?: number;

  @CreateDateColumn()
  readonly createdAt!: Date;

  @UpdateDateColumn()
  readonly updatedAt!: Date;

  @OneToMany(() => MenuItemEntity, menuItem => menuItem.restaurant)
  readonly menuItems!: MenuItemEntity[];
}
