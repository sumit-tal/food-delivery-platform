import { ConflictException, NotFoundException, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { RestaurantModel, PublicRestaurant } from '../models/restaurant.model';
import type { MenuItemModel, MenuModel } from '../models/menu.model';
import { slugify } from '../utils/slug.util';

export interface CreateRestaurantData {
  readonly name: string;
  readonly cuisineTypes: readonly string[];
  readonly city: string;
  readonly area?: string;
  readonly isOpen?: boolean;
  readonly rating?: number;
  readonly etaMin?: number;
  readonly etaMax?: number;
}

export interface ListFilter {
  readonly city?: string;
  readonly cuisine?: string;
  readonly isOpen?: boolean;
  readonly page: number;
  readonly limit: number;
}

/**
 * RestaurantsRepository manages in-memory persistence for restaurants and menus.
 */
@Injectable()
export class RestaurantsRepository {
  private readonly restaurantsById: Map<string, RestaurantModel> = new Map<string, RestaurantModel>();
  private readonly idBySlug: Map<string, string> = new Map<string, string>();
  private readonly menusByRestaurantId: Map<string, MenuModel> = new Map<string, MenuModel>();

  /**
   * Creates a restaurant and returns its public view.
   */
  public createRestaurant(data: CreateRestaurantData): PublicRestaurant {
    const model = this.buildRestaurantModel(data);
    this.persistRestaurant(model);
    return this.toPublic(model);
  }

  /**
   * Lists restaurants using simple filters and pagination.
   */
  public list(filter: ListFilter): readonly PublicRestaurant[] {
    const all = Array.from(this.restaurantsById.values());
    const filtered = all.filter(r => {
      if (filter.city && r.city.toLowerCase() !== filter.city.toLowerCase()) {
        return false;
      }
      if (filter.cuisine && !r.cuisineTypes.some(c => c.toLowerCase() === filter.cuisine!.toLowerCase())) {
        return false;
      }
      if (typeof filter.isOpen === 'boolean' && r.isOpen !== filter.isOpen) {
        return false;
      }
      return true;
    });
    const start = (filter.page - 1) * filter.limit;
    const end = start + filter.limit;
    return filtered.slice(start, end).map(r => this.toPublic(r));
  }

  /**
   * Returns full restaurant model by slug or throws NotFound.
   */
  public getBySlug(slug: string): RestaurantModel {
    const id = this.idBySlug.get(slug);
    if (!id) {
      throw new NotFoundException('Restaurant not found');
    }
    const r = this.restaurantsById.get(id);
    if (!r) {
      throw new NotFoundException('Restaurant not found');
    }
    return r;
  }

  /**
   * Upserts full menu for a restaurant with optimistic version check.
   */
  public upsertMenu(restaurantId: string, items: readonly MenuItemModel[], expectedVersion?: number): MenuModel {
    const current = this.menusByRestaurantId.get(restaurantId);
    if (typeof expectedVersion === 'number' && current && current.version !== expectedVersion) {
      throw new ConflictException('Menu version mismatch');
    }
    const version = current ? current.version + 1 : 1;
    const menu: MenuModel = { restaurantId, version, items: [...items] };
    this.menusByRestaurantId.set(restaurantId, menu);
    return menu;
  }

  /**
   * Retrieves current menu if present, otherwise null.
   */
  public getMenu(restaurantId: string): MenuModel | null {
    const m = this.menusByRestaurantId.get(restaurantId);
    return m ?? null;
  }

  private buildRestaurantModel(data: CreateRestaurantData): RestaurantModel {
    const id = uuidv4();
    const slug = this.ensureUniqueSlug(slugify(data.name));
    const now = new Date();
    return {
      id,
      name: data.name,
      slug,
      cuisineTypes: [...data.cuisineTypes],
      city: data.city,
      area: data.area,
      isOpen: data.isOpen ?? false,
      rating: data.rating,
      etaMin: data.etaMin,
      etaMax: data.etaMax,
      createdAt: now,
      updatedAt: now
    };
  }

  private persistRestaurant(model: RestaurantModel): void {
    this.restaurantsById.set(model.id, model);
    this.idBySlug.set(model.slug, model.id);
  }

  private ensureUniqueSlug(base: string): string {
    let slug = base;
    let i = 1;
    while (this.idBySlug.has(slug)) {
      slug = `${base}-${i}`;
      i += 1;
    }
    return slug;
  }

  private toPublic(r: RestaurantModel): PublicRestaurant {
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      cuisineTypes: [...r.cuisineTypes],
      city: r.city,
      area: r.area,
      isOpen: r.isOpen,
      rating: r.rating,
      etaMin: r.etaMin,
      etaMax: r.etaMax
    };
  }
}
