import { RestaurantsService } from 'src/modules/restaurants/restaurants.service';
import type {
  RestaurantsRepository,
  CreateRestaurantData,
  ListFilter,
} from 'src/modules/restaurants/repositories/restaurants.repository';
import type { MenuCache } from 'src/modules/restaurants/cache/menu-cache';
import type { ConfigService } from '@nestjs/config';
import type {
  RestaurantModel,
  PublicRestaurant,
} from 'src/modules/restaurants/models/restaurant.model';
import type { MenuItemModel, MenuModel } from 'src/modules/restaurants/models/menu.model';

// Helper builders
const buildRestaurantModel = (overrides: Partial<RestaurantModel> = {}): RestaurantModel => ({
  id: overrides.id ?? 'rid-1',
  name: overrides.name ?? 'Resto',
  slug: overrides.slug ?? 'resto',
  cuisineTypes: overrides.cuisineTypes ?? ['italian'],
  city: overrides.city ?? 'Rome',
  area: overrides.area,
  isOpen: overrides.isOpen ?? true,
  rating: overrides.rating,
  etaMin: overrides.etaMin,
  etaMax: overrides.etaMax,
  createdAt: overrides.createdAt ?? new Date('2020-01-01T00:00:00Z'),
  updatedAt: overrides.updatedAt ?? new Date('2020-01-01T00:00:00Z'),
});

const buildMenu = (overrides: Partial<MenuModel> = {}): MenuModel => ({
  restaurantId: overrides.restaurantId ?? 'rid-1',
  version: overrides.version ?? 1,
  items: overrides.items ?? [],
});

const buildItem = (overrides: Partial<MenuItemModel> = {}): MenuItemModel => ({
  id: overrides.id ?? 'i1',
  restaurantId: overrides.restaurantId ?? 'rid-1',
  name: overrides.name ?? 'Item',
  description: overrides.description,
  priceCents: overrides.priceCents ?? 100,
  currency: overrides.currency ?? 'USD',
  isAvailable: overrides.isAvailable ?? true,
  tags: overrides.tags,
  imageUrl: overrides.imageUrl,
});

// Typed mocks
type RepoMock = jest.Mocked<
  Pick<RestaurantsRepository, 'createRestaurant' | 'list' | 'getBySlug' | 'getMenu' | 'upsertMenu'>
>;

type CacheMock = jest.Mocked<MenuCache>;

const createService = (deps?: {
  repo?: RepoMock;
  cache?: CacheMock;
  config?: jest.Mocked<ConfigService>;
}): {
  service: RestaurantsService;
  repo: RepoMock;
  cache: CacheMock;
  config: jest.Mocked<ConfigService>;
} => {
  const repo: RepoMock =
    deps?.repo ??
    ({
      createRestaurant: jest.fn(),
      list: jest.fn(),
      getBySlug: jest.fn(),
      getMenu: jest.fn(),
      upsertMenu: jest.fn(),
    } as unknown as RepoMock);
  const cache: CacheMock =
    deps?.cache ??
    ({ getLatest: jest.fn(), set: jest.fn(), invalidate: jest.fn() } as unknown as CacheMock);
  const config: jest.Mocked<ConfigService> =
    deps?.config ?? ({ get: jest.fn() } as unknown as jest.Mocked<ConfigService>);
  return {
    service: new RestaurantsService(repo as any, cache as any, config),
    repo,
    cache,
    config,
  };
};

describe('RestaurantsService - onboard', () => {
  it('Then delegates to repository.createRestaurant', () => {
    const { service, repo } = createService();
    const data: CreateRestaurantData = {
      name: 'Cafe Rio',
      cuisineTypes: ['mexican'],
      city: 'Austin',
      isOpen: true,
      rating: 4.5,
      etaMin: 20,
      etaMax: 40,
    };
    const pub: PublicRestaurant = {
      id: 'rid',
      name: 'Cafe Rio',
      slug: 'cafe-rio',
      cuisineTypes: ['mexican'],
      city: 'Austin',
      isOpen: true,
    };
    repo.createRestaurant.mockReturnValue(pub);

    const res = service.onboard(data);

    expect(repo.createRestaurant).toHaveBeenCalledWith(data);
    expect(res).toBe(pub);
  });
});

describe('RestaurantsService - list', () => {
  it('Then delegates to repository.list', () => {
    const { service, repo } = createService();
    const filter: ListFilter = { city: 'Austin', page: 1, limit: 10 };
    const items: readonly PublicRestaurant[] = [
      { id: '1', name: 'A', slug: 'a', cuisineTypes: ['x'], city: 'Austin', isOpen: true },
    ];
    repo.list.mockReturnValue(items);

    const res = service.list(filter);

    expect(repo.list).toHaveBeenCalledWith(filter);
    expect(res).toBe(items);
  });
});

describe('RestaurantsService - getDetailsBySlug', () => {
  it('Then maps RestaurantModel to PublicRestaurant with copied arrays', () => {
    const { service, repo } = createService();
    const model = buildRestaurantModel({ cuisineTypes: ['x', 'y'] });
    repo.getBySlug.mockReturnValue(model);

    const pub = service.getDetailsBySlug('resto');

    expect(pub.id).toBe(model.id);
    expect(pub.cuisineTypes).toEqual(model.cuisineTypes);
    expect(pub.cuisineTypes).not.toBe(model.cuisineTypes); // copy
  });
});

describe('RestaurantsService - getMenuBySlug', () => {
  it('Then returns cached menu when available', async () => {
    const { service, repo, cache } = createService();
    const model = buildRestaurantModel();
    const cached = buildMenu({ restaurantId: model.id, version: 2 });
    repo.getBySlug.mockReturnValue(model);
    cache.getLatest.mockResolvedValue(cached);

    const res = await service.getMenuBySlug(model.slug);

    expect(res.version).toBe(2);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('Then fetches from repo on cache miss, caches it, and applies CDN when configured', async () => {
    const config = {
      get: jest.fn((_k: string) => 'https://cdn.example.com/'),
    } as unknown as jest.Mocked<ConfigService>;
    const { service, repo, cache } = createService({ config });
    const model = buildRestaurantModel();
    const repoMenu = buildMenu({
      restaurantId: model.id,
      version: 1,
      items: [buildItem({ imageUrl: 'img/a.jpg' }), buildItem({ imageUrl: 'http://abs/b.jpg' })],
    });
    repo.getBySlug.mockReturnValue(model);
    cache.getLatest.mockResolvedValue(null);
    repo.getMenu.mockReturnValue(repoMenu);

    const res = await service.getMenuBySlug(model.slug);

    expect(res.version).toBe(1);
    expect(cache.set).toHaveBeenCalledWith(repoMenu);
    expect(res.items[0]?.imageUrl).toBe('https://cdn.example.com/img/a.jpg');
    expect(res.items[1]?.imageUrl).toBe('http://abs/b.jpg');
  });

  it('Then throws NotFound when repo has no menu', async () => {
    const { service, repo, cache } = createService();
    const model = buildRestaurantModel();
    repo.getBySlug.mockReturnValue(model);
    cache.getLatest.mockResolvedValue(null);
    repo.getMenu.mockReturnValue(null);

    await expect(service.getMenuBySlug(model.slug)).rejects.toThrow('Menu not found');
  });
});

describe('RestaurantsService - upsertMenuBySlug', () => {
  it('Then sets restaurantId on items, delegates to repo, caches, and returns new menu', async () => {
    const { service, repo, cache } = createService();
    const model = buildRestaurantModel();
    repo.getBySlug.mockReturnValue(model);
    const inputItems: readonly MenuItemModel[] = [
      {
        id: `${model.slug}-Burger`,
        restaurantId: '',
        name: 'Burger',
        priceCents: 999,
        currency: 'USD',
        isAvailable: true,
      },
    ];
    const returned = buildMenu({
      restaurantId: model.id,
      version: 1,
      items: [{ ...inputItems[0], restaurantId: model.id }],
    });
    repo.upsertMenu.mockReturnValue(returned);

    const res = await service.upsertMenuBySlug(model.slug, inputItems, 0);

    expect(repo.upsertMenu).toHaveBeenCalledWith(
      model.id,
      [{ ...inputItems[0], restaurantId: model.id }],
      0,
    );
    expect(cache.set).toHaveBeenCalledWith(returned);
    expect(res).toBe(returned);
  });
});
