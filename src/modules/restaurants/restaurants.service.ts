import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PublicRestaurant } from './models/restaurant.model';
import type { MenuItemModel, MenuModel } from './models/menu.model';
import { RestaurantsRepository, type ListFilter, type CreateRestaurantData } from './repositories/restaurants.repository';
import type { MenuCache } from './cache/menu-cache';

/**
 * RestaurantsService provides business logic for catalog operations.
 */
@Injectable()
export class RestaurantsService {
  public constructor(
    private readonly repo: RestaurantsRepository,
    @Inject('MenuCache') private readonly cache: MenuCache,
    private readonly config: ConfigService
  ) {}

  public onboard(data: CreateRestaurantData): PublicRestaurant {
    return this.repo.createRestaurant(data);
  }

  public list(filter: ListFilter): readonly PublicRestaurant[] {
    return this.repo.list(filter);
  }

  public getDetailsBySlug(slug: string): PublicRestaurant {
    const model = this.repo.getBySlug(slug);
    return {
      id: model.id,
      name: model.name,
      slug: model.slug,
      cuisineTypes: [...model.cuisineTypes],
      city: model.city,
      area: model.area,
      isOpen: model.isOpen,
      rating: model.rating,
      etaMin: model.etaMin,
      etaMax: model.etaMax
    };
  }

  public async getMenuBySlug(slug: string): Promise<MenuModel> {
    const restaurant = this.repo.getBySlug(slug);
    const cached = await this.cache.getLatest(restaurant.id);
    if (cached) {
      return this.withCdn(cached);
    }
    const menu = this.repo.getMenu(restaurant.id);
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }
    await this.cache.set(menu);
    return this.withCdn(menu);
  }

  public async upsertMenuBySlug(slug: string, items: readonly MenuItemModel[], expectedVersion?: number): Promise<MenuModel> {
    const restaurant = this.repo.getBySlug(slug);
    const fixedItems: readonly MenuItemModel[] = items.map((i) => ({ ...i, restaurantId: restaurant.id }));
    const menu = this.repo.upsertMenu(restaurant.id, fixedItems, expectedVersion);
    await this.cache.set(menu);
    return menu;
  }

  private withCdn(menu: MenuModel): MenuModel {
    const base = this.config.get<string>('CDN_BASE_URL');
    if (!base) {
      return menu;
    }
    const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
    const items = menu.items.map(i => {
      if (!i.imageUrl) {
        return i;
      }
      const isAbsolute = /^https?:\/\//i.test(i.imageUrl);
      if (isAbsolute) {
        return i;
      }
      const path = i.imageUrl.startsWith('/') ? i.imageUrl : `/${i.imageUrl}`;
      return { ...i, imageUrl: `${normalized}${path}` };
    });
    return { ...menu, items };
  }
}
