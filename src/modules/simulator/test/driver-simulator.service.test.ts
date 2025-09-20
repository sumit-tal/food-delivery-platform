import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Logger } from '@nestjs/common';
import { DriverSimulatorService } from '../services/driver-simulator.service';
import { MovementPatternService } from '../services/movement-pattern.service';
import type { SimulatorConfig } from '../interfaces';

/**
 * Tests for DriverSimulatorService covering initialization, updates, getters, and destination handling
 */
describe('DriverSimulatorService', () => {
  let service: DriverSimulatorService;
  let movementPatternService: MovementPatternService;

  const mockConfig: SimulatorConfig = {
    driverCount: 5,
    updateFrequencyMs: 1000,
    autoStart: false,
    initialRegion: {
      centerLat: 37.7749,
      centerLng: -122.4194,
      radiusKm: 3,
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DriverSimulatorService,
        MovementPatternService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: unknown) => {
              switch (key) {
                case 'LOCATION_UPDATE_ENDPOINT':
                  return 'http://localhost:3000/api/tracking/simulator/location';
                case 'SIMULATOR_API_KEY':
                  return 'simulator-local-dev';
                default:
                  return defaultValue;
              }
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<DriverSimulatorService>(DriverSimulatorService);
    movementPatternService = moduleRef.get<MovementPatternService>(MovementPatternService);

    // Optionally stub logger methods to avoid noisy test output
    const logger = (service as unknown as { logger: Logger }).logger;
    jest.spyOn(logger, 'log').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});

    // Initialize drivers before each test
    service.initialize(mockConfig);

    // Stub out network side-effect method to a noop
    jest.spyOn(service, 'sendLocationUpdates').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('When initializing', () => {
    it('Then should create the specified number of drivers', () => {
      // Arrange
      const config: SimulatorConfig = { ...mockConfig, driverCount: 10 };

      // Act
      service.initialize(config);

      // Assert
      expect(service.getActiveDriverCount()).toBe(10);
      expect(service.getAllDrivers()).toHaveLength(10);
    });

    it('Then should use the specified initial region to place new drivers', () => {
      // Arrange
      const spy = jest.spyOn(movementPatternService, 'getRandomPositionInRegion');
      const config: SimulatorConfig = {
        ...mockConfig,
        initialRegion: { centerLat: 40.7128, centerLng: -74.006, radiusKm: 5 },
      };

      // Act
      service.initialize(config);

      // Assert
      expect(spy).toHaveBeenCalledWith(40.7128, -74.006, 5);
    });
  });

  describe('When updating driver locations', () => {
    it('Then should update each driver position via MovementPatternService', () => {
      // Arrange
      const spy = jest.spyOn(movementPatternService, 'updateDriverPosition');

      // Act
      service.updateDriverLocations();

      // Assert
      expect(spy).toHaveBeenCalledTimes(mockConfig.driverCount);
    });

    it('Then should send a non-empty batch of updates', () => {
      // Arrange
      const sendSpy = jest.spyOn(service, 'sendLocationUpdates');

      // Act
      service.updateDriverLocations();

      // Assert
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const sentArg = (sendSpy.mock.calls[0] as unknown[])[0] as Array<unknown>;
      expect(Array.isArray(sentArg)).toBe(true);
      expect(sentArg.length).toBe(mockConfig.driverCount);
    });
  });

  describe('When sending location updates', () => {
    it('Then should return early for an empty list', () => {
      // Arrange
      const logger = (service as unknown as { logger: Logger }).logger;
      const debugSpy = jest.spyOn(logger, 'debug');

      // Act
      service.sendLocationUpdates([]);

      // Assert: With empty input, no debug logs should be emitted
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });

  describe('When using getters', () => {
    it('Then getAllDrivers should return a shallow copy (immutability)', () => {
      // Arrange
      const list = service.getAllDrivers();

      // Act
      list.push({
        id: 'fake',
        latitude: 0,
        longitude: 0,
        heading: 0,
        speed: 0,
        batteryLevel: 100,
        accuracy: 5,
        status: 'available',
        destination: null,
        route: [],
        currentRouteIndex: 0,
      });

      // Assert
      expect(list).toHaveLength(mockConfig.driverCount + 1);
      expect(service.getActiveDriverCount()).toBe(mockConfig.driverCount);
    });

    it('Then getDriverById should find existing and return undefined for missing', () => {
      // Arrange
      const first = service.getAllDrivers()[0];

      // Act & Assert
      expect(service.getDriverById(first.id)).toBeDefined();
      expect(service.getDriverById('non-existent-id')).toBeUndefined();
    });
  });

  describe('When setting a destination', () => {
    it('Then should return false for an unknown driver', () => {
      // Act
      const ok = service.setDriverDestination('missing', 1, 2);

      // Assert
      expect(ok).toBe(false);
    });

    it('Then should set destination, generate a route and update status', () => {
      // Arrange
      const driver = service.getAllDrivers()[0];
      const spy = jest.spyOn(movementPatternService, 'generateRoute');
      const destLat = driver.latitude + 0.02;
      const destLng = driver.longitude + 0.02;

      // Act
      const ok = service.setDriverDestination(driver.id, destLat, destLng);
      const updated = service.getDriverById(driver.id)!;

      // Assert
      expect(ok).toBe(true);
      expect(spy).toHaveBeenCalledWith(driver.latitude, driver.longitude, destLat, destLng);
      expect(updated.destination).toEqual({ latitude: destLat, longitude: destLng });
      expect(Array.isArray(updated.route)).toBe(true);
      expect(updated.currentRouteIndex).toBe(0);
      expect(updated.status).toBe('en_route');
    });
  });
});
