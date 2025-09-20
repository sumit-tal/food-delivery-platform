import { Test, TestingModule } from '@nestjs/testing';
import { TrackingService } from '../src/modules/tracking/tracking.service';
import { LocationProcessingService } from '../src/modules/tracking/services/location-processing.service';
import { DriverLocationRepository } from '../src/modules/tracking/repositories/driver-location.repository';
import { ActiveDeliveryRepository } from '../src/modules/tracking/repositories/active-delivery.repository';
import { NotFoundException } from '@nestjs/common';

describe('TrackingService', () => {
  let service: TrackingService;
  let locationProcessingService: LocationProcessingService;
  let driverLocationRepository: DriverLocationRepository;
  let activeDeliveryRepository: ActiveDeliveryRepository;

  const mockLocationProcessingService = {
    processLocationUpdate: jest.fn(),
    getDriverLocation: jest.fn(),
  };

  const mockDriverLocationRepository = {
    saveLocation: jest.fn(),
    getLatestLocation: jest.fn(),
    getLocationHistory: jest.fn(),
    findNearbyDrivers: jest.fn(),
  };

  const mockActiveDeliveryRepository = {
    getActiveDeliveryByOrderId: jest.fn(),
    createActiveDelivery: jest.fn(),
    updateDeliveryStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingService,
        {
          provide: LocationProcessingService,
          useValue: mockLocationProcessingService,
        },
        {
          provide: DriverLocationRepository,
          useValue: mockDriverLocationRepository,
        },
        {
          provide: ActiveDeliveryRepository,
          useValue: mockActiveDeliveryRepository,
        },
      ],
    }).compile();

    service = module.get<TrackingService>(TrackingService);
    locationProcessingService = module.get<LocationProcessingService>(LocationProcessingService);
    driverLocationRepository = module.get<DriverLocationRepository>(DriverLocationRepository);
    activeDeliveryRepository = module.get<ActiveDeliveryRepository>(ActiveDeliveryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processLocationUpdate', () => {
    it('should process location update and return location ID', async () => {
      const locationUpdate = {
        driverId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: 37.7749,
        longitude: -122.4194,
      };
      const locationId = '123e4567-e89b-12d3-a456-426614174001';

      mockLocationProcessingService.processLocationUpdate.mockResolvedValue(undefined);
      mockDriverLocationRepository.saveLocation.mockResolvedValue(locationId);

      const result = await service.processLocationUpdate(locationUpdate);

      expect(mockLocationProcessingService.processLocationUpdate).toHaveBeenCalledWith(
        locationUpdate,
      );
      expect(mockDriverLocationRepository.saveLocation).toHaveBeenCalledWith(locationUpdate);
      expect(result).toBe(locationId);
    });

    it('should throw error if location processing fails', async () => {
      const locationUpdate = {
        driverId: '123e4567-e89b-12d3-a456-426614174000',
        latitude: 37.7749,
        longitude: -122.4194,
      };
      const error = new Error('Processing failed');

      mockLocationProcessingService.processLocationUpdate.mockRejectedValue(error);

      await expect(service.processLocationUpdate(locationUpdate)).rejects.toThrow(error);
    });
  });

  describe('getDriverLocation', () => {
    it('should return in-memory location if available', async () => {
      const driverId = '123e4567-e89b-12d3-a456-426614174000';
      const inMemoryLocation = {
        driverId,
        latitude: 37.7749,
        longitude: -122.4194,
        heading: 90,
        speed: 30,
        timestamp: '2025-09-13T10:30:00Z',
      };

      mockLocationProcessingService.getDriverLocation.mockReturnValue(inMemoryLocation);

      const result = await service.getDriverLocation(driverId);

      expect(mockLocationProcessingService.getDriverLocation).toHaveBeenCalledWith(driverId);
      expect(mockDriverLocationRepository.getLatestLocation).not.toHaveBeenCalled();
      expect(result).toEqual({
        driverId,
        latitude: inMemoryLocation.latitude,
        longitude: inMemoryLocation.longitude,
        heading: inMemoryLocation.heading,
        speed: inMemoryLocation.speed,
        timestamp: inMemoryLocation.timestamp,
        source: 'memory',
      });
    });

    it('should return database location if in-memory location is not available', async () => {
      const driverId = '123e4567-e89b-12d3-a456-426614174000';
      const dbLocation = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        driver_id: driverId,
        latitude: 37.7749,
        longitude: -122.4194,
        heading: 90,
        speed: 30,
        timestamp: new Date('2025-09-13T10:30:00Z'),
      };

      mockLocationProcessingService.getDriverLocation.mockReturnValue(null);
      mockDriverLocationRepository.getLatestLocation.mockResolvedValue(dbLocation);

      const result = await service.getDriverLocation(driverId);

      expect(mockLocationProcessingService.getDriverLocation).toHaveBeenCalledWith(driverId);
      expect(mockDriverLocationRepository.getLatestLocation).toHaveBeenCalledWith(driverId);
      expect(result).toEqual({
        driverId,
        latitude: dbLocation.latitude,
        longitude: dbLocation.longitude,
        heading: dbLocation.heading,
        speed: dbLocation.speed,
        timestamp: dbLocation.timestamp,
        source: 'database',
      });
    });

    it('should throw NotFoundException if no location data is found', async () => {
      const driverId = '123e4567-e89b-12d3-a456-426614174000';

      mockLocationProcessingService.getDriverLocation.mockReturnValue(null);
      mockDriverLocationRepository.getLatestLocation.mockResolvedValue(null);

      await expect(service.getDriverLocation(driverId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrderTracking', () => {
    it('should return order tracking information', async () => {
      const orderId = '123e4567-e89b-12d3-a456-426614174000';
      const driverId = '123e4567-e89b-12d3-a456-426614174001';

      const delivery = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        order_id: orderId,
        driver_id: driverId,
        status: 'in_progress',
        pickup_latitude: 37.7749,
        pickup_longitude: -122.4194,
        delivery_latitude: 37.7833,
        delivery_longitude: -122.4167,
        started_at: '2025-09-13T10:00:00Z',
        estimated_delivery_time: '2025-09-13T10:30:00Z',
        completed_at: null,
      };

      const driverLocation = {
        driverId,
        latitude: 37.78,
        longitude: -122.418,
        heading: 45,
        speed: 20,
        timestamp: '2025-09-13T10:15:00Z',
        source: 'memory' as const,
      };

      mockActiveDeliveryRepository.getActiveDeliveryByOrderId.mockResolvedValue(delivery);
      jest.spyOn(service, 'getDriverLocation').mockResolvedValue(driverLocation);

      const result = await service.getOrderTracking(orderId);

      expect(mockActiveDeliveryRepository.getActiveDeliveryByOrderId).toHaveBeenCalledWith(orderId);
      expect(service.getDriverLocation).toHaveBeenCalledWith(driverId);
      expect(result).toEqual({
        orderId,
        deliveryId: delivery.id,
        status: delivery.status,
        driverId: delivery.driver_id,
        pickup: {
          latitude: delivery.pickup_latitude,
          longitude: delivery.pickup_longitude,
        },
        destination: {
          latitude: delivery.delivery_latitude,
          longitude: delivery.delivery_longitude,
        },
        currentLocation: {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          heading: driverLocation.heading,
          updatedAt: new Date(driverLocation.timestamp),
        },
        startedAt: delivery.started_at,
        estimatedDeliveryTime: delivery.estimated_delivery_time,
        completedAt: delivery.completed_at,
      });
    });

    it('should throw NotFoundException if no active delivery is found', async () => {
      const orderId = '123e4567-e89b-12d3-a456-426614174000';

      mockActiveDeliveryRepository.getActiveDeliveryByOrderId.mockResolvedValue(null);

      await expect(service.getOrderTracking(orderId)).rejects.toThrow(NotFoundException);
    });
  });
});
