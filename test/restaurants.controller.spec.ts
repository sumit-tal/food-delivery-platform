import { Test, type TestingModule } from '@nestjs/testing';
import { RestaurantsController } from 'src/modules/restaurants/restaurants.controller';
import { RestaurantsService } from 'src/modules/restaurants/restaurants.service';
import type { PublicRestaurant } from 'src/modules/restaurants/models/restaurant.model';
import type { MenuItemModel, MenuModel } from 'src/modules/restaurants/models/menu.model';

type ServiceMock = Pick<RestaurantsService, 'list' | 'getDetailsBySlug' | 'getMenuBySlug' | 'upsertMenuBySlug' | 'onboard'>;

function createModule(service: ServiceMock): Promise<TestingModule> {
  return Test.createTestingModule({
    controllers: [RestaurantsController],
    providers: [{ provide: RestaurantsService, useValue: service }]
  }).compile();
}

describe('RestaurantsController - list', () => {
  it('Then returns items with pagination envelope', async () => {
    const items: readonly PublicRestaurant[] = [
      { id: '1', name: 'A', slug: 'a', cuisineTypes: ['x'], city: 'X', isOpen: true },
    ];
    const service: ServiceMock = {
      onboard: jest.fn(),
      list: jest.fn((): readonly PublicRestaurant[] => items),
      getDetailsBySlug: jest.fn(),
      getMenuBySlug: jest.fn(),
      upsertMenuBySlug: jest.fn()
    };
    const moduleRef = await createModule(service);
    const controller = moduleRef.get(RestaurantsController);
    const res = controller.list(undefined, undefined, undefined, 1, 10);
    expect(res.items).toHaveLength(1);
    expect(res.page).toBe(1);
  });
});

describe('RestaurantsController - getBySlug', () => {
  it('Then returns public restaurant data', async () => {
    const service: ServiceMock = {
      onboard: jest.fn(),
      list: jest.fn((): readonly PublicRestaurant[] => []),
      getDetailsBySlug: jest.fn((slug: string): PublicRestaurant => ({ id: 'id-' + slug, name: 'N', slug, cuisineTypes: [], city: 'X', isOpen: true })),
      getMenuBySlug: jest.fn(),
      upsertMenuBySlug: jest.fn()
    };
    const moduleRef = await createModule(service);
    const controller = moduleRef.get(RestaurantsController);
    const r = controller.getBySlug('abc');
    expect(r.slug).toBe('abc');
    expect(r.id).toBe('id-abc');
  });
});

describe('RestaurantsController - getMenu', () => {
  it('Then returns the menu model', async () => {
    const menu: MenuModel = { restaurantId: 'rid', version: 1, items: [] };
    const service: ServiceMock = {
      onboard: jest.fn(),
      list: jest.fn((): readonly PublicRestaurant[] => []),
      getDetailsBySlug: jest.fn(),
      getMenuBySlug: jest.fn(async (): Promise<MenuModel> => menu),
      upsertMenuBySlug: jest.fn()
    };
    const moduleRef = await createModule(service);
    const controller = moduleRef.get(RestaurantsController);
    const res = await controller.getMenu('abc');
    expect(res.version).toBe(1);
  });
});

describe('RestaurantsController - upsertMenu', () => {
  it('Then forwards to service and returns new menu', async () => {
    const returned: MenuModel = { restaurantId: 'rid', version: 1, items: [{ id: 'i1', restaurantId: 'rid', name: 'Item', priceCents: 100, currency: 'USD', isAvailable: true, tags: [] }] };
    const service: ServiceMock = {
      onboard: jest.fn(),
      list: jest.fn((): readonly PublicRestaurant[] => []),
      getDetailsBySlug: jest.fn(),
      getMenuBySlug: jest.fn(),
      upsertMenuBySlug: jest.fn(async (_slug: string, items: readonly MenuItemModel[]): Promise<MenuModel> => ({ restaurantId: 'rid', version: 1, items: items as MenuItemModel[] }))
    };
    const moduleRef = await createModule(service);
    const controller = moduleRef.get(RestaurantsController);
    const dto = { items: [{ name: 'Item', priceCents: 100, currency: 'USD', isAvailable: true }] };
    const res = await controller.upsertMenu('abc', dto);
    expect(res.items[0]?.name).toBe('Item');
  });
});
