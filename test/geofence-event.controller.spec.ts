import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { GeofenceEventController } from '../src/modules/geofencing/controllers/geofence-event.controller';
import {
  GeofenceEventService,
  GeofenceEventType,
  GeofenceEvent,
} from '../src/modules/geofencing/services/geofence-event.service';
import type { Point } from '../src/modules/geofencing/interfaces';

// Mock types for testing
interface MockEntityLocation {
  entityId: string;
  entityType: string;
  location: Point;
  timestamp: Date;
  geofenceIds: Set<string>;
}

interface MockGeofence {
  id: string;
  name: string;
  boundary: any;
  center: Point;
  createdAt: Date;
  updatedAt: Date;
}

// Test data
const testPoint: Point = { latitude: 37.7749, longitude: -122.4194 };
const testEntityId = 'test-entity-1';
const testEntityType = 'driver';
const testGeofenceId = 'test-geofence-1';

describe('GeofenceEventController', () => {
  let controller: GeofenceEventController;
  let mockService: jest.Mocked<GeofenceEventService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeofenceEventController],
      providers: [
        {
          provide: GeofenceEventService,
          useValue: {
            updateEntityLocation: jest.fn(),
            getEntityLocation: jest.fn(),
            getEntitiesInGeofence: jest.fn(),
            clearEntityLocation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<GeofenceEventController>(GeofenceEventController);
    mockService = module.get(GeofenceEventService);
  });

  describe('When updating entity location', () => {
    it('Then should call service and return events', () => {
      const events = [{ type: GeofenceEventType.ENTER }] as any[];
      mockService.updateEntityLocation.mockReturnValue(events);

      const result = controller.updateEntityLocation(testEntityId, testEntityType, testPoint);

      expect(mockService.updateEntityLocation).toHaveBeenCalledWith(
        testEntityId,
        testEntityType,
        testPoint,
        undefined,
      );
      expect(result).toEqual(events);
    });

    it('Then should handle metadata parameter', () => {
      const metadata = { speed: 25.5 };
      const events: any[] = [];
      mockService.updateEntityLocation.mockReturnValue(events);

      const result = controller.updateEntityLocation(
        testEntityId,
        testEntityType,
        testPoint,
        metadata,
      );

      expect(mockService.updateEntityLocation).toHaveBeenCalledWith(
        testEntityId,
        testEntityType,
        testPoint,
        metadata,
      );
      expect(result).toEqual(events);
    });
  });

  describe('When getting entity location', () => {
    it('Then should return location when found', () => {
      const location = {
        entityId: testEntityId,
        entityType: testEntityType,
        location: testPoint,
      } as any;
      mockService.getEntityLocation.mockReturnValue(location);

      const result = controller.getEntityLocation(testEntityType, testEntityId);

      expect(mockService.getEntityLocation).toHaveBeenCalledWith(testEntityId, testEntityType);
      expect(result).toEqual(location);
    });

    it('Then should return undefined when not found', () => {
      mockService.getEntityLocation.mockReturnValue(undefined);

      const result = controller.getEntityLocation(testEntityType, testEntityId);

      expect(result).toBeUndefined();
    });
  });

  describe('When getting entities in geofence', () => {
    it('Then should return entity list', () => {
      const entities = [{ entityId: testEntityId }] as any[];
      mockService.getEntitiesInGeofence.mockReturnValue(entities);

      const result = controller.getEntitiesInGeofence(testGeofenceId);

      expect(mockService.getEntitiesInGeofence).toHaveBeenCalledWith(testGeofenceId);
      expect(result).toEqual(entities);
    });

    it('Then should return empty array when no entities', () => {
      mockService.getEntitiesInGeofence.mockReturnValue([]);

      const result = controller.getEntitiesInGeofence(testGeofenceId);

      expect(result).toEqual([]);
    });
  });

  describe('When clearing entity location', () => {
    it('Then should return success when entity exists', () => {
      mockService.clearEntityLocation.mockReturnValue(true);

      const result = controller.clearEntityLocation(testEntityType, testEntityId);

      expect(mockService.clearEntityLocation).toHaveBeenCalledWith(testEntityId, testEntityType);
      expect(result).toEqual({ success: true });
    });

    it('Then should return failure when entity does not exist', () => {
      mockService.clearEntityLocation.mockReturnValue(false);

      const result = controller.clearEntityLocation(testEntityType, testEntityId);

      expect(result).toEqual({ success: false });
    });
  });
});
