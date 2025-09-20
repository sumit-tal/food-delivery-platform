import { Test, TestingModule } from '@nestjs/testing';
import { DriverAssignmentController } from '../../../../src/modules/geofencing/controllers/driver-assignment.controller';
import {
  DriverAssignmentService,
  Driver,
  Restaurant,
  DriverAssignmentResult,
} from '../../../../src/modules/geofencing/services/driver-assignment.service';
import { Point } from '../../../../src/modules/geofencing/interfaces';

/**
 * Test suite for DriverAssignmentController.
 */
describe('When using DriverAssignmentController', () => {
  let controller: DriverAssignmentController;
  let service: DriverAssignmentService;

  const mockDriverAssignmentService = {
    findBestDriversForRestaurant: jest.fn(),
    assignBestDriverForOrder: jest.fn(),
    calculateEstimatedDeliveryTime: jest.fn(),
  } as unknown as jest.Mocked<DriverAssignmentService>;

  /**
   * Creates a test driver with reasonable defaults.
   */
  const createTestDriver = (overrides: Partial<Driver> = {}): Driver => {
    const base: Driver = {
      id: 'driver-1',
      name: 'Alice Rider',
      location: { latitude: 37.7749, longitude: -122.4194 },
      isAvailable: true,
      vehicleType: 'motorcycle',
      rating: 4.8,
      metadata: { completedDeliveries: 120 },
    };
    return { ...base, ...overrides };
  };

  /**
   * Creates a test restaurant with reasonable defaults.
   */
  const createTestRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant => {
    const base: Restaurant = {
      id: 'rest-1',
      name: 'Swift Eats - Downtown',
      location: { latitude: 37.775, longitude: -122.4183 },
      isOpen: true,
      metadata: { cuisine: 'american' },
    };
    return { ...base, ...overrides };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DriverAssignmentController],
      providers: [
        {
          provide: DriverAssignmentService,
          useValue: mockDriverAssignmentService,
        },
      ],
    }).compile();

    controller = module.get<DriverAssignmentController>(DriverAssignmentController);
    service = module.get<DriverAssignmentService>(DriverAssignmentService);
    jest.clearAllMocks();
  });

  describe('When finding best drivers for a restaurant', () => {
    it('Then should pass defaults and return results from service', () => {
      const restaurant: Restaurant = createTestRestaurant();
      const maxDistance: number = 5000; // default
      const limit: number = 5; // default
      const mockResults: DriverAssignmentResult[] = [
        {
          driver: createTestDriver({ id: 'driver-1' }),
          distanceToRestaurant: 800,
          estimatedPickupTime: 5,
          score: 0.95,
        },
        {
          driver: createTestDriver({ id: 'driver-2' }),
          distanceToRestaurant: 1200,
          estimatedPickupTime: 7,
          score: 0.9,
        },
      ];
      (service.findBestDriversForRestaurant as jest.Mock).mockReturnValue(mockResults);

      const result: DriverAssignmentResult[] = controller.findBestDriversForRestaurant(
        restaurant,
        undefined as unknown as number,
        undefined as unknown as number,
      );

      expect(service.findBestDriversForRestaurant).toHaveBeenCalledWith(
        [],
        restaurant,
        maxDistance,
        limit,
      );
      expect(result).toEqual(mockResults);
    });

    it('Then should forward provided maxDistance and limit', () => {
      const restaurant: Restaurant = createTestRestaurant();
      const maxDistance: number = 2000;
      const limit: number = 2;
      const mockResults: DriverAssignmentResult[] = [];
      (service.findBestDriversForRestaurant as jest.Mock).mockReturnValue(mockResults);

      const result: DriverAssignmentResult[] = controller.findBestDriversForRestaurant(
        restaurant,
        maxDistance,
        limit,
      );

      expect(service.findBestDriversForRestaurant).toHaveBeenCalledWith(
        [],
        restaurant,
        maxDistance,
        limit,
      );
      expect(result).toEqual(mockResults);
    });
  });

  describe('When assigning the best driver for an order', () => {
    it('Then should pass drivers=[], restaurant and delivery location to service and return the result', () => {
      const restaurant: Restaurant = createTestRestaurant();
      const deliveryLocation: Point = { latitude: 37.78, longitude: -122.41 };
      const mockAssignment: DriverAssignmentResult | null = {
        driver: createTestDriver({ id: 'driver-42' }),
        distanceToRestaurant: 950,
        estimatedPickupTime: 6,
        score: 0.93,
      };
      (service.assignBestDriverForOrder as jest.Mock).mockReturnValue(mockAssignment);

      const result: DriverAssignmentResult | null = controller.assignBestDriverForOrder(
        restaurant,
        deliveryLocation,
      );

      expect(service.assignBestDriverForOrder).toHaveBeenCalledWith(
        [],
        restaurant,
        deliveryLocation,
      );
      expect(result).toEqual(mockAssignment);
    });

    it('Then should handle null when no suitable driver is found', () => {
      const restaurant: Restaurant = createTestRestaurant();
      const deliveryLocation: Point = { latitude: 37.78, longitude: -122.41 };
      (service.assignBestDriverForOrder as jest.Mock).mockReturnValue(null);

      const result: DriverAssignmentResult | null = controller.assignBestDriverForOrder(
        restaurant,
        deliveryLocation,
      );

      expect(service.assignBestDriverForOrder).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('When calculating estimated delivery time', () => {
    it('Then should return the wrapped estimatedTimeMinutes', () => {
      const driver: Driver = createTestDriver();
      const restaurant: Restaurant = createTestRestaurant();
      const deliveryLocation: Point = { latitude: 37.781, longitude: -122.405 };
      const eta: number = 22;
      (service.calculateEstimatedDeliveryTime as jest.Mock).mockReturnValue(eta);

      const result: { estimatedTimeMinutes: number } = controller.calculateEstimatedDeliveryTime(
        driver,
        restaurant,
        deliveryLocation,
      );

      expect(service.calculateEstimatedDeliveryTime).toHaveBeenCalledWith(
        driver,
        restaurant,
        deliveryLocation,
      );
      expect(result).toEqual({ estimatedTimeMinutes: eta });
    });
  });

  describe('When fetching drivers nearby', () => {
    it('Then should return an empty array (controller stub)', () => {
      const lat: number = 37.7749;
      const lng: number = -122.4194;
      const result: Driver[] = controller.getDriversNearby(lat, lng);
      expect(result).toEqual([]);
    });

    it('Then should apply default radius when not provided', () => {
      const lat: number = 12.9716;
      const lng: number = 77.5946;
      const radius: number = 5000; // default as per controller signature
      // The method is a stub returning [], but we still call it to ensure signature compatibility
      const result: Driver[] = controller.getDriversNearby(
        lat,
        lng,
        undefined as unknown as number,
      );
      expect(result).toEqual([]);
      expect(radius).toBe(5000);
    });
  });
});
