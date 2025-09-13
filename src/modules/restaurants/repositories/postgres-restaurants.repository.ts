import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { RestaurantEntity } from '../entities/restaurant.entity';
import { MenuEntity } from '../entities/menu.entity';
import { MenuItemEntity } from '../entities/menu-item.entity';
import { MenuCategoryEntity } from '../entities/menu-category.entity';

import type { RestaurantModel, PublicRestaurant } from '../models/restaurant.model';
import type { MenuItemModel, MenuModel } from '../models/menu.model';
import type { CreateRestaurantData, ListFilter } from './restaurants.repository';
import { slugify } from '../utils/slug.util';

/**
 * PostgresRestaurantsRepository implements the restaurant repository interface using TypeORM
 */
@Injectable()
export class PostgresRestaurantsRepository {
  public constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepository: Repository<RestaurantEntity>,
    @InjectRepository(MenuEntity)
    private readonly menuRepository: Repository<MenuEntity>,
    @InjectRepository(MenuItemEntity)
    private readonly menuItemRepository: Repository<MenuItemEntity>,
    @InjectRepository(MenuCategoryEntity)
    private readonly menuCategoryRepository: Repository<MenuCategoryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a restaurant and returns its public view.
   */
  public async createRestaurant(data: CreateRestaurantData): Promise<PublicRestaurant> {
    const slug = await this.generateUniqueSlug(data.name);
    const restaurant = this.restaurantRepository.create({
      id: uuidv4(),
      name: data.name,
      slug,
      cuisineTypes: data.cuisineTypes,
      city: data.city,
      area: data.area,
      isOpen: data.isOpen ?? false,
      rating: data.rating,
      etaMin: data.etaMin,
      etaMax: data.etaMax,
    });

    await this.restaurantRepository.save(restaurant);
    return this.toPublic(restaurant);
  }

  /**
   * Lists restaurants using simple filters and pagination.
   */
  public async list(filter: ListFilter): Promise<readonly PublicRestaurant[]> {
    const query = this.restaurantRepository.createQueryBuilder('restaurant');

    if (filter.city) {
      query.andWhere('LOWER(restaurant.city) = LOWER(:city)', { city: filter.city });
    }

    if (filter.cuisine) {
      // Using array contains for cuisine types
      query.andWhere(':cuisine = ANY(restaurant.cuisineTypes)', { cuisine: filter.cuisine });
    }

    if (typeof filter.isOpen === 'boolean') {
      query.andWhere('restaurant.isOpen = :isOpen', { isOpen: filter.isOpen });
    }

    // Add pagination
    query
      .skip((filter.page - 1) * filter.limit)
      .take(filter.limit)
      .orderBy('restaurant.name', 'ASC');

    const restaurants = await query.getMany();
    return restaurants.map(r => this.toPublic(r));
  }

  /**
   * Returns full restaurant model by slug or throws NotFound.
   */
  public async getBySlug(slug: string): Promise<RestaurantModel> {
    const restaurant = await this.restaurantRepository.findOne({ where: { slug } });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    return restaurant;
  }

  /**
   * Upserts full menu for a restaurant with optimistic version check.
   */
  public async upsertMenu(
    restaurantId: string, 
    items: readonly MenuItemModel[], 
    expectedVersion?: number
  ): Promise<MenuModel> {
    // Start a transaction
    return this.dataSource.transaction(async (manager) => {
      // Get the current menu version if it exists
      const currentMenu = await manager.findOne(MenuEntity, {
        where: { restaurantId, isActive: true },
        order: { version: 'DESC' },
      });

      // Check version if expectedVersion is provided
      if (typeof expectedVersion === 'number' && currentMenu && currentMenu.version !== expectedVersion) {
        throw new ConflictException('Menu version mismatch');
      }

      const version = currentMenu ? currentMenu.version + 1 : 1;

      // Create new menu version
      const newMenu = manager.create(MenuEntity, {
        id: uuidv4(),
        restaurantId,
        version,
        isActive: true,
      });

      // Save the new menu
      await manager.save(newMenu);

      // If there's a previous active menu, mark it as inactive
      if (currentMenu) {
        await manager.update(MenuEntity, { id: currentMenu.id }, { isActive: false });
      }

      // Delete existing menu items for this restaurant
      await manager.delete(MenuItemEntity, { restaurantId });

      // Create and save new menu items
      const menuItems = items.map((item, index) => 
        manager.create(MenuItemEntity, {
          id: item.id || uuidv4(),
          restaurantId,
          name: item.name,
          description: item.description,
          priceCents: item.priceCents,
          currency: item.currency,
          isAvailable: item.isAvailable,
          tags: item.tags,
          imageUrl: item.imageUrl,
          displayOrder: index,
        })
      );

      await manager.save(menuItems);

      // Return the menu model
      return {
        restaurantId,
        version,
        items: menuItems.map(item => ({
          id: item.id,
          restaurantId: item.restaurantId,
          name: item.name,
          description: item.description,
          priceCents: item.priceCents,
          currency: item.currency,
          isAvailable: item.isAvailable,
          tags: item.tags || [],
          imageUrl: item.imageUrl,
        })),
      };
    });
  }

  /**
   * Retrieves current menu if present, otherwise null.
   */
  public async getMenu(restaurantId: string): Promise<MenuModel | null> {
    // Get the active menu version
    const menu = await this.menuRepository.findOne({
      where: { restaurantId, isActive: true },
      order: { version: 'DESC' },
    });

    if (!menu) {
      return null;
    }

    // Get all menu items for this restaurant
    const items = await this.menuItemRepository.find({
      where: { restaurantId },
      order: { displayOrder: 'ASC' },
    });

    return {
      restaurantId,
      version: menu.version,
      items: items.map(item => ({
        id: item.id,
        restaurantId: item.restaurantId,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        currency: item.currency,
        isAvailable: item.isAvailable,
        tags: item.tags || [],
        imageUrl: item.imageUrl,
      })),
    };
  }

  /**
   * Generates a unique slug for a restaurant name
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    
    // Keep checking until we find a unique slug
    while (await this.slugExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  /**
   * Checks if a slug already exists
   */
  private async slugExists(slug: string): Promise<boolean> {
    const count = await this.restaurantRepository.count({ where: { slug } });
    return count > 0;
  }

  /**
   * Converts a restaurant entity to a public restaurant model
   */
  private toPublic(r: RestaurantEntity): PublicRestaurant {
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      cuisineTypes: r.cuisineTypes,
      city: r.city,
      area: r.area,
      isOpen: r.isOpen,
      rating: r.rating,
      etaMin: r.etaMin,
      etaMax: r.etaMax,
    };
  }
}
