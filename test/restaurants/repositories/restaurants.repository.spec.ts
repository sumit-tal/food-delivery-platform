import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  RestaurantsRepository,
  type CreateRestaurantData,
  type ListFilter,
} from 'src/modules/restaurants/repositories/restaurants.repository';
import type {
  RestaurantModel,
  PublicRestaurant,
} from 'src/modules/restaurants/models/restaurant.model';
import type { MenuItemModel, MenuModel } from 'src/modules/restaurants/models/menu.model';

/**
 * Builders for strongly-typed test data
 */
const buildCreateData = (overrides: Partial<CreateRestaurantData> = {}): CreateRestaurantData => ({
  name: overrides.name ?? 'Pasta Place',
  cuisineTypes: overrides.cuisineTypes ?? ['italian'],
  city: overrides.city ?? 'Rome',
  area: overrides.area,
  isOpen: overrides.isOpen ?? true,
  rating: overrides.rating,
  etaMin: overrides.etaMin,
  etaMax: overrides.etaMax,
});

const buildItem = (overrides: Partial<MenuItemModel> = {}): MenuItemModel => ({
  id: overrides.id ?? 'item-1',
  restaurantId: overrides.restaurantId ?? 'rid-1',
  name: overrides.name ?? 'Margherita',
  description: overrides.description,
  priceCents: overrides.priceCents ?? 1200,
  currency: overrides.currency ?? 'USD',
  isAvailable: overrides.isAvailable ?? true,
  tags: overrides.tags,
  imageUrl: overrides.imageUrl,
});

const expectPublicMatchesModel = (pub: PublicRestaurant, model: RestaurantModel): void => {
  expect(pub.id).toBe(model.id);
  expect(pub.name).toBe(model.name);
  expect(pub.slug).toBe(model.slug);
  expect(pub.cuisineTypes).toEqual(model.cuisineTypes);
  expect(pub.cuisineTypes).not.toBe(model.cuisineTypes);
  expect(pub.city).toBe(model.city);
  expect(pub.area).toBe(model.area);
  expect(pub.isOpen).toBe(model.isOpen);
  expect(pub.rating).toBe(model.rating);
  expect(pub.etaMin).toBe(model.etaMin);
  expect(pub.etaMax).toBe(model.etaMax);
};

describe('RestaurantsRepository', () => {
  let repo: RestaurantsRepository;

  beforeEach(() => {
    repo = new RestaurantsRepository();
  });

  describe('createRestaurant', () => {
    it('Then creates a restaurant and returns its public view', () => {
      const data: CreateRestaurantData = buildCreateData();

      const pub = repo.createRestaurant(data);

      // fetch the full model via slug to assert persisted fields
      const model = repo.getBySlug(pub.slug);
      expectPublicMatchesModel(pub, model);
      // ensure arrays are copied
      expect(pub.cuisineTypes).not.toBe(model.cuisineTypes);
    });

    it('Then ensures unique slug generation when names collide', () => {
      const a: PublicRestaurant = repo.createRestaurant(buildCreateData({ name: 'Cafe Rio' }));
      const b: PublicRestaurant = repo.createRestaurant(buildCreateData({ name: 'Cafe Rio' }));
      const c: PublicRestaurant = repo.createRestaurant(buildCreateData({ name: 'Cafe Rio' }));

      expect(a.slug).toBe('cafe-rio');
      expect(b.slug).toBe('cafe-rio-1');
      expect(c.slug).toBe('cafe-rio-2');
    });
  });

  describe('list', () => {
    beforeEach(() => {
      repo.createRestaurant(
        buildCreateData({ name: 'A1', city: 'Austin', cuisineTypes: ['mexican'], isOpen: true }),
      );
      repo.createRestaurant(
        buildCreateData({ name: 'B1', city: 'Austin', cuisineTypes: ['italian'], isOpen: false }),
      );
      repo.createRestaurant(
        buildCreateData({ name: 'C1', city: 'Boston', cuisineTypes: ['mexican'], isOpen: true }),
      );
      repo.createRestaurant(
        buildCreateData({ name: 'D1', city: 'Austin', cuisineTypes: ['thai'], isOpen: true }),
      );
    });

    it('Then filters by city (case-insensitive)', () => {
      const filter: ListFilter = { city: 'austin', page: 1, limit: 10 };
      const res = repo.list(filter);
      expect(res.every((r) => r.city.toLowerCase() === 'austin')).toBe(true);
    });

    it('Then filters by cuisine (case-insensitive)', () => {
      const filter: ListFilter = { cuisine: 'MEXICAN', page: 1, limit: 10 };
      const res = repo.list(filter);
      expect(res.length).toBe(2);
      expect(res.every((r) => r.cuisineTypes.map((c) => c.toLowerCase()).includes('mexican'))).toBe(
        true,
      );
    });

    it('Then filters by open status', () => {
      const filter: ListFilter = { isOpen: true, page: 1, limit: 10 };
      const res = repo.list(filter);
      expect(res.every((r) => r.isOpen === true)).toBe(true);
    });

    it('Then paginates results deterministically', () => {
      const page1 = repo.list({ page: 1, limit: 2 });
      const page2 = repo.list({ page: 2, limit: 2 });
      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      // non-overlapping ids
      const ids1 = new Set(page1.map((r) => r.id));
      expect(page2.every((r) => !ids1.has(r.id))).toBe(true);
    });
  });

  describe('getBySlug', () => {
    it('Then returns full model when found', () => {
      const pub = repo.createRestaurant(buildCreateData({ name: 'Zed' }));
      const model = repo.getBySlug(pub.slug);
      expect(model.id).toBe(pub.id);
      expect(model.slug).toBe(pub.slug);
      expect(model.createdAt instanceof Date).toBe(true);
      expect(model.updatedAt instanceof Date).toBe(true);
    });

    it('Then throws NotFound when slug is unknown', () => {
      expect(() => repo.getBySlug('nope')).toThrow(NotFoundException);
    });
  });

  describe('menus', () => {
    it('Then getMenu returns null when none exists', () => {
      expect(repo.getMenu('rid-x')).toBeNull();
    });

    it('Then upsertMenu creates first version and can be retrieved', () => {
      const items: readonly MenuItemModel[] = [buildItem({ restaurantId: 'rid-1' })];
      const menu = repo.upsertMenu('rid-1', items);
      expect(menu.version).toBe(1);
      expect(menu.items).toEqual(items);
      expect(repo.getMenu('rid-1')).toEqual(menu);
    });

    it('Then upsertMenu increments version and overwrites items', () => {
      const rId = 'rid-123';
      const m1 = repo.upsertMenu(rId, [buildItem({ id: 'i1', restaurantId: rId })]);
      const m2 = repo.upsertMenu(rId, [buildItem({ id: 'i2', restaurantId: rId })], m1.version);
      expect(m2.version).toBe(m1.version + 1);
      expect(m2.items[0]?.id).toBe('i2');
    });

    it('Then upsertMenu throws ConflictException on version mismatch', () => {
      const rId = 'rid-9';
      const first = repo.upsertMenu(rId, [buildItem({ id: 'i1', restaurantId: rId })]);
      expect(first.version).toBe(1);
      expect(() => repo.upsertMenu(rId, [], 999)).toThrow(ConflictException);
    });
  });
});
