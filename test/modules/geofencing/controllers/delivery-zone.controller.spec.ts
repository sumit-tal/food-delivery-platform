import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryZoneController } from '../../../../src/modules/geofencing/controllers/delivery-zone.controller';
import {
  DeliveryZoneService,
  DeliveryZone,
} from '../../../../src/modules/geofencing/services/delivery-zone.service';
import { Point } from '../../../../src/modules/geofencing/interfaces';
import { NotFoundException } from '@nestjs/common';

describe('When using DeliveryZoneController', () => {
  let controller: DeliveryZoneController;
  let deliveryZoneService: DeliveryZoneService;

  const mockDeliveryZoneService = {
    createDeliveryZone: jest.fn(),
    getDeliveryZoneById: jest.fn(),
    getAllDeliveryZones: jest.fn(),
    getActiveDeliveryZones: jest.fn(),
    updateDeliveryZone: jest.fn(),
    deleteDeliveryZone: jest.fn(),
    findDeliveryZonesContainingPoint: jest.fn(),
    findDeliveryZonesWithinRadius: jest.fn(),
    calculateEstimatedDeliveryTime: jest.fn(),
    calculateDeliveryFee: jest.fn(),
  };

  // Mock data for tests
  const mockGeofence = {
    id: 'geofence-123',
    name: 'Downtown Zone',
    boundary: {
      points: [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
        { latitude: 1, longitude: 1 },
        { latitude: 0, longitude: 1 },
        { latitude: 0, longitude: 0 },
      ],
    },
    center: { latitude: 0.5, longitude: 0.5 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDeliveryZone: DeliveryZone = {
    id: 'zone-123',
    name: 'Downtown Delivery Zone',
    geofence: mockGeofence,
    estimatedDeliveryTimeMinutes: 30,
    deliveryFee: 2.99,
    isActive: true,
    metadata: { region: 'downtown' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeliveryZoneController],
      providers: [
        {
          provide: DeliveryZoneService,
          useValue: mockDeliveryZoneService,
        },
      ],
    }).compile();

    controller = module.get<DeliveryZoneController>(DeliveryZoneController);
    deliveryZoneService = module.get<DeliveryZoneService>(DeliveryZoneService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When creating a delivery zone', () => {
    it('Then should create a delivery zone and return it', () => {
      // Arrange
      mockDeliveryZoneService.createDeliveryZone.mockReturnValue(mockDeliveryZone);

      // Act
      const result = controller.createDeliveryZone(mockDeliveryZone);

      // Assert
      expect(mockDeliveryZoneService.createDeliveryZone).toHaveBeenCalledWith(mockDeliveryZone);
      expect(result).toEqual(mockDeliveryZone);
    });
  });

  describe('When getting all delivery zones', () => {
    it('Then should return all delivery zones', () => {
      // Arrange
      const mockDeliveryZones = [mockDeliveryZone];
      mockDeliveryZoneService.getAllDeliveryZones.mockReturnValue(mockDeliveryZones);

      // Act
      const result = controller.getAllDeliveryZones();

      // Assert
      expect(mockDeliveryZoneService.getAllDeliveryZones).toHaveBeenCalled();
      expect(result).toEqual(mockDeliveryZones);
    });
  });

  describe('When getting active delivery zones', () => {
    it('Then should return active delivery zones', () => {
      // Arrange
      const mockActiveDeliveryZones = [mockDeliveryZone];
      mockDeliveryZoneService.getActiveDeliveryZones.mockReturnValue(mockActiveDeliveryZones);

      // Act
      const result = controller.getActiveDeliveryZones();

      // Assert
      expect(mockDeliveryZoneService.getActiveDeliveryZones).toHaveBeenCalled();
      expect(result).toEqual(mockActiveDeliveryZones);
    });
  });

  describe('When getting a delivery zone by ID', () => {
    it('Then should return the delivery zone when found', () => {
      // Arrange
      const zoneId = 'zone-123';
      mockDeliveryZoneService.getDeliveryZoneById.mockReturnValue(mockDeliveryZone);

      // Act
      const result = controller.getDeliveryZoneById(zoneId);

      // Assert
      expect(mockDeliveryZoneService.getDeliveryZoneById).toHaveBeenCalledWith(zoneId);
      expect(result).toEqual(mockDeliveryZone);
    });

    it('Then should throw NotFoundException when delivery zone is not found', () => {
      // Arrange
      const zoneId = 'non-existent-zone';
      mockDeliveryZoneService.getDeliveryZoneById.mockReturnValue(undefined);

      // Act & Assert
      expect(() => controller.getDeliveryZoneById(zoneId)).toThrow(NotFoundException);
      expect(() => controller.getDeliveryZoneById(zoneId)).toThrow(
        `Delivery zone with ID ${zoneId} not found`,
      );
    });
  });

  describe('When updating a delivery zone', () => {
    it('Then should update and return the delivery zone when found', () => {
      // Arrange
      const zoneId = 'zone-123';
      const updatedDeliveryZone = { ...mockDeliveryZone, name: 'Updated Zone' };
      mockDeliveryZoneService.updateDeliveryZone.mockReturnValue(updatedDeliveryZone);

      // Act
      const result = controller.updateDeliveryZone(zoneId, updatedDeliveryZone);

      // Assert
      expect(mockDeliveryZoneService.updateDeliveryZone).toHaveBeenCalledWith(
        zoneId,
        updatedDeliveryZone,
      );
      expect(result).toEqual(updatedDeliveryZone);
    });

    it('Then should throw NotFoundException when delivery zone is not found', () => {
      // Arrange
      const zoneId = 'non-existent-zone';
      const updatedDeliveryZone = { ...mockDeliveryZone, name: 'Updated Zone' };
      mockDeliveryZoneService.updateDeliveryZone.mockReturnValue(undefined);

      // Act & Assert
      expect(() => controller.updateDeliveryZone(zoneId, updatedDeliveryZone)).toThrow(
        NotFoundException,
      );
      expect(() => controller.updateDeliveryZone(zoneId, updatedDeliveryZone)).toThrow(
        `Delivery zone with ID ${zoneId} not found`,
      );
    });
  });

  describe('When deleting a delivery zone', () => {
    it('Then should delete the delivery zone and return success message when found', () => {
      // Arrange
      const zoneId = 'zone-123';
      mockDeliveryZoneService.deleteDeliveryZone.mockReturnValue(true);

      // Act
      const result = controller.deleteDeliveryZone(zoneId);

      // Assert
      expect(mockDeliveryZoneService.deleteDeliveryZone).toHaveBeenCalledWith(zoneId);
      expect(result).toEqual({ message: `Delivery zone with ID ${zoneId} deleted successfully` });
    });

    it('Then should throw NotFoundException when delivery zone is not found', () => {
      // Arrange
      const zoneId = 'non-existent-zone';
      mockDeliveryZoneService.deleteDeliveryZone.mockReturnValue(false);

      // Act & Assert
      expect(() => controller.deleteDeliveryZone(zoneId)).toThrow(NotFoundException);
      expect(() => controller.deleteDeliveryZone(zoneId)).toThrow(
        `Delivery zone with ID ${zoneId} not found`,
      );
    });
  });

  describe('When finding delivery zones containing a point', () => {
    it('Then should return delivery zones containing the point', () => {
      // Arrange
      const lat = 37.7749;
      const lng = -122.4194;
      const point: Point = { latitude: lat, longitude: lng };
      const mockContainingZones = [mockDeliveryZone];
      mockDeliveryZoneService.findDeliveryZonesContainingPoint.mockReturnValue(mockContainingZones);

      // Act
      const result = controller.findDeliveryZonesContainingPoint(lat, lng);

      // Assert
      expect(mockDeliveryZoneService.findDeliveryZonesContainingPoint).toHaveBeenCalledWith(point);
      expect(result).toEqual(mockContainingZones);
    });
  });

  describe('When finding delivery zones within radius', () => {
    it('Then should return delivery zones within the specified radius', () => {
      // Arrange
      const lat = 37.7749;
      const lng = -122.4194;
      const radius = 1000;
      const center: Point = { latitude: lat, longitude: lng };
      const mockZonesWithinRadius = [mockDeliveryZone];
      mockDeliveryZoneService.findDeliveryZonesWithinRadius.mockReturnValue(mockZonesWithinRadius);

      // Act
      const result = controller.findDeliveryZonesWithinRadius(lat, lng, radius);

      // Assert
      expect(mockDeliveryZoneService.findDeliveryZonesWithinRadius).toHaveBeenCalledWith(
        center,
        radius,
      );
      expect(result).toEqual(mockZonesWithinRadius);
    });
  });

  describe('When calculating estimated delivery time', () => {
    it('Then should return estimated delivery time in minutes', () => {
      // Arrange
      const originLat = 37.7749;
      const originLng = -122.4194;
      const destLat = 37.7849;
      const destLng = -122.4094;
      const origin: Point = { latitude: originLat, longitude: originLng };
      const destination: Point = { latitude: destLat, longitude: destLng };
      const estimatedTime = 25;
      mockDeliveryZoneService.calculateEstimatedDeliveryTime.mockReturnValue(estimatedTime);

      // Act
      const result = controller.calculateEstimatedDeliveryTime(
        originLat,
        originLng,
        destLat,
        destLng,
      );

      // Assert
      expect(mockDeliveryZoneService.calculateEstimatedDeliveryTime).toHaveBeenCalledWith(
        origin,
        destination,
      );
      expect(result).toEqual({ estimatedTimeMinutes: estimatedTime });
    });
  });

  describe('When calculating delivery fee', () => {
    it('Then should return delivery fee', () => {
      // Arrange
      const originLat = 37.7749;
      const originLng = -122.4194;
      const destLat = 37.7849;
      const destLng = -122.4094;
      const origin: Point = { latitude: originLat, longitude: originLng };
      const destination: Point = { latitude: destLat, longitude: destLng };
      const deliveryFee = 4.5;
      mockDeliveryZoneService.calculateDeliveryFee.mockReturnValue(deliveryFee);

      // Act
      const result = controller.calculateDeliveryFee(originLat, originLng, destLat, destLng);

      // Assert
      expect(mockDeliveryZoneService.calculateDeliveryFee).toHaveBeenCalledWith(
        origin,
        destination,
      );
      expect(result).toEqual({ deliveryFee });
    });
  });
});
