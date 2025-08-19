import { RestaurantsService } from '../src/modules/restaurants/restaurants.service';
import { RestaurantsRepository } from '../src/modules/restaurants/repositories/restaurants.repository';
import type { MenuCache } from '../src/modules/restaurants/cache/menu-cache';
import type { MenuModel } from '../src/modules/restaurants/models/menu.model';
import type { ConfigService } from '@nestjs/config';

class FakeMenuCache implements MenuCache {
  public latest: Map<string, MenuModel> = new Map<string, MenuModel>();
  public setCalls: Array<MenuModel> = [];
  public invalidateCalls: Array<string> = [];

  public getLatest(restaurantId: string): Promise<MenuModel | null> {
    return Promise.resolve(this.latest.get(restaurantId) ?? null);
  }

  public set(menu: MenuModel): Promise<void> {
    this.setCalls.push(menu);
    this.latest.set(menu.restaurantId, menu);
    return Promise.resolve();
  }

  public invalidate(restaurantId: string): Promise<void> {
    this.invalidateCalls.push(restaurantId);
    this.latest.delete(restaurantId);
    return Promise.resolve();
  }
}

class FakeConfigService {
  public constructor(private readonly values: Record<string, unknown> = {}) {}
  public get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

describe('RestaurantsService - When interacting with menus', () => {
  let repo: RestaurantsRepository;
  let cache: FakeMenuCache;
  let service: RestaurantsService;

  beforeEach(() => {
    repo = new RestaurantsRepository();
    cache = new FakeMenuCache();
    service = new RestaurantsService(repo, cache, new FakeConfigService() as unknown as ConfigService);
  });

  it('Then returns menu from repo on cache miss and stores it in cache', async () => {
    const r = repo.createRestaurant({
      name: 'Pasta Place',
      cuisineTypes: ['Italian'],
      city: 'SF',
      area: 'Downtown',
      isOpen: true,
      rating: 4.5,
      etaMin: 20,
      etaMax: 40,
    });
    const slug = r.slug;
    repo.upsertMenu(r.id, [
      {
        id: '1',
        restaurantId: r.id,
        name: 'Spaghetti',
        priceCents: 1299,
        currency: 'USD',
        isAvailable: true,
      },
    ]);

    const menu = await service.getMenuBySlug(slug);

    expect(menu).toBeTruthy();
    expect(menu.restaurantId).toBe(r.id);
    expect(cache.setCalls.length).toBe(1);
  });

  it('Then returns cached menu on cache hit without altering cache', async () => {
    const r = repo.createRestaurant({
      name: 'Sushi Hub',
      cuisineTypes: ['Japanese'],
      city: 'NYC',
      area: 'Midtown',
      isOpen: true,
    });
    const slug = r.slug;

    // Repo has version 1
    const repoMenu = repo.upsertMenu(r.id, [
      {
        id: 'r1',
        restaurantId: r.id,
        name: 'Roll',
        priceCents: 999,
        currency: 'USD',
        isAvailable: true,
      },
    ]);
    expect(repoMenu.version).toBe(1);

    // Cache has version 2 (newer)
    const cachedMenu: MenuModel = { restaurantId: r.id, version: 2, items: repoMenu.items };
    cache.latest.set(r.id, cachedMenu);

    const result = await service.getMenuBySlug(slug);

    expect(result.version).toBe(2);
    expect(cache.setCalls.length).toBe(0);
  });

  it('Then upsert increments version and updates cache', async () => {
    const r = repo.createRestaurant({
      name: 'Burger Barn',
      cuisineTypes: ['American'],
      city: 'Austin',
      isOpen: false,
    });

    const v1 = await service.upsertMenuBySlug(r.slug, [
      {
        id: 'b1',
        restaurantId: '',
        name: 'Burger',
        priceCents: 899,
        currency: 'USD',
        isAvailable: true,
      },
    ]);

    expect(v1.version).toBe(1);
    expect(cache.setCalls.length).toBe(1);

    const v2 = await service.upsertMenuBySlug(
      r.slug,
      [
        {
          id: 'b2',
          restaurantId: '',
          name: 'Cheese Burger',
          priceCents: 999,
          currency: 'USD',
          isAvailable: true,
        },
      ],
      1,
    );

    expect(v2.version).toBe(2);
    expect(cache.setCalls.length).toBe(2);
  });

  it('Then rewrites relative image URLs using CDN_BASE_URL while leaving absolute URLs intact', async () => {
    // Recreate service with CDN configured
    service = new RestaurantsService(
      repo,
      cache,
      new FakeConfigService({ CDN_BASE_URL: 'https://cdn.example.com' }) as unknown as ConfigService,
    );

    const r = repo.createRestaurant({
      name: 'CDN Cafe',
      cuisineTypes: ['Cafe'],
      city: 'LA',
      isOpen: true,
    });

    // Upsert a menu with relative and absolute URLs
    repo.upsertMenu(r.id, [
      { id: 'i1', restaurantId: r.id, name: 'Latte', priceCents: 499, currency: 'USD', isAvailable: true, imageUrl: 'images/latte.jpg' },
      { id: 'i2', restaurantId: r.id, name: 'Mocha', priceCents: 599, currency: 'USD', isAvailable: true, imageUrl: 'http://example.com/mocha.jpg' },
      { id: 'i3', restaurantId: r.id, name: 'Espresso', priceCents: 399, currency: 'USD', isAvailable: true }
    ]);

    const menu = await service.getMenuBySlug(r.slug);
    expect(menu.items[0].imageUrl).toBe('https://cdn.example.com/images/latte.jpg');
    expect(menu.items[1].imageUrl).toBe('http://example.com/mocha.jpg');
    expect(menu.items[2].imageUrl).toBeUndefined();
  });
});
