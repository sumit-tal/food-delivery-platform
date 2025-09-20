import { Test, type TestingModule } from '@nestjs/testing';
import { RestaurantsController } from 'src/modules/restaurants/restaurants.controller';
import { RestaurantsService } from 'src/modules/restaurants/restaurants.service';
import type { PublicRestaurant } from 'src/modules/restaurants/models/restaurant.model';
import type { MenuItemModel } from 'src/modules/restaurants/models/menu.model';
import type { CreateRestaurantDto } from 'src/modules/restaurants/dto/create-restaurant.dto';
import type { UpsertMenuDto } from 'src/modules/restaurants/dto/upsert-menu.dto';

/**
 * Unit tests for RestaurantsController covering create and upsertMenu flows.
 */
interface ServiceMock {
  readonly onboard: jest.MockedFunction<RestaurantsService['onboard']>;
  readonly list: jest.MockedFunction<RestaurantsService['list']>;
  readonly getDetailsBySlug: jest.MockedFunction<RestaurantsService['getDetailsBySlug']>;
  readonly getMenuBySlug: jest.MockedFunction<RestaurantsService['getMenuBySlug']>;
  readonly upsertMenuBySlug: jest.MockedFunction<RestaurantsService['upsertMenuBySlug']>;
}

const buildCreateDto = (): CreateRestaurantDto => ({
  name: 'Cafe Rio',
  cuisineTypes: ['mexican'],
  city: 'Austin',
  area: 'Downtown',
  isOpen: true,
  rating: 4.5,
  etaMin: 20,
  etaMax: 40,
});

const buildExpectedFromDto = (dto: CreateRestaurantDto): PublicRestaurant => ({
  id: 'r-1',
  name: dto.name,
  slug: 'cafe-rio',
  cuisineTypes: dto.cuisineTypes,
  city: dto.city,
  area: dto.area,
  isOpen: dto.isOpen ?? true,
  rating: dto.rating,
  etaMin: dto.etaMin,
  etaMax: dto.etaMax,
});

const buildUpsertDto = (): UpsertMenuDto => ({
  expectedVersion: 2,
  items: [
    { name: 'Burger', description: 'Juicy', priceCents: 999, currency: 'USD', isAvailable: true, tags: ['popular'], imageUrl: '/img/burger.jpg' },
    { name: 'Fries', description: 'Crispy', priceCents: 399, currency: 'USD', isAvailable: true, tags: ['side'] },
  ],
});

describe('RestaurantsController - create', () => {
  let controller: RestaurantsController;
  let service: ServiceMock;

  beforeEach(async () => {
    service = {
      onboard: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['onboard']>,
      list: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['list']>,
      getDetailsBySlug: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['getDetailsBySlug']>,
      getMenuBySlug: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['getMenuBySlug']>,
      upsertMenuBySlug: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['upsertMenuBySlug']>,
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RestaurantsController],
      providers: [{ provide: RestaurantsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(RestaurantsController);
  });

  it('When create is called Then forwards DTO fields to service.onboard and returns its result', () => {
    const dto = buildCreateDto();
    const expected = buildExpectedFromDto(dto);
    service.onboard.mockReturnValue(expected);

    const res = controller.create(dto);

    expect(service.onboard).toHaveBeenCalledTimes(1);
    expect(service.onboard).toHaveBeenCalledWith({
      name: dto.name,
      cuisineTypes: dto.cuisineTypes,
      city: dto.city,
      area: dto.area,
      isOpen: dto.isOpen,
      rating: dto.rating,
      etaMin: dto.etaMin,
      etaMax: dto.etaMax,
    });
    expect(res).toBe(expected);
  });
});

describe('RestaurantsController - upsertMenu', () => {
  let controller: RestaurantsController;
  let service: ServiceMock;

  beforeEach(async () => {
    service = {
      onboard: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['onboard']>,
      list: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['list']>,
      getDetailsBySlug: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['getDetailsBySlug']>,
      getMenuBySlug: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['getMenuBySlug']>,
      upsertMenuBySlug: jest.fn() as unknown as jest.MockedFunction<RestaurantsService['upsertMenuBySlug']>,
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RestaurantsController],
      providers: [{ provide: RestaurantsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(RestaurantsController);
  });

  it('When upsertMenu is called Then maps item ids using slug and forwards to service', async () => {
    const slug = 'best-bites';
    const dto = buildUpsertDto();

    service.upsertMenuBySlug.mockImplementation((_slug, items, expectedVersion) => Promise.resolve({
      restaurantId: 'rid-1',
      version: expectedVersion ?? 0,
      items: items as MenuItemModel[],
    }));

    const res = await controller.upsertMenu(slug, dto);

    expect(service.upsertMenuBySlug).toHaveBeenCalledTimes(1);
    const [passedSlug, passedItems, version] = service.upsertMenuBySlug.mock.calls[0];
    expect(passedSlug).toBe(slug);
    expect(version).toBe(2);
    expect(passedItems[0]?.id).toBe(`${slug}-Burger`);
    expect(passedItems[0]?.restaurantId).toBe('');
    expect(passedItems[0]?.name).toBe('Burger');
    expect(passedItems[1]?.id).toBe(`${slug}-Fries`);

    expect(res.version).toBe(2);
    expect(res.items).toHaveLength(2);
  });
});
