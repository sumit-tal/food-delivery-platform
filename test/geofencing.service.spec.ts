import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { GeofenceService } from '../src/modules/geofencing/services/geofence.service';
import { GeofenceRepository } from '../src/modules/geofencing/repositories/geofence.repository';
import type { Point } from '../src/modules/geofencing/interfaces';
import type { CreateGeofenceDto } from '../src/modules/geofencing/dto/create-geofence.dto';

// Test data factory
function createTestGeofenceDto(): CreateGeofenceDto {
  return {
    name: 'Test Geofence',
    boundary: {
      points: [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7749, longitude: -122.4094 },
        { latitude: 37.7649, longitude: -122.4094 },
        { latitude: 37.7649, longitude: -122.4194 },
      ]
    },
    center: { latitude: 37.7699, longitude: -122.4144 },
    metadata: { city: 'San Francisco' }
  };
}

describe('GeofenceService', () => {
  let service: GeofenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeofenceService, GeofenceRepository],
    }).compile();

    service = module.get<GeofenceService>(GeofenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('When creating a geofence', () => {
    it('Then should create and return a geofence with an ID', () => {
      // Arrange
      const createGeofenceDto = createTestGeofenceDto();

      // Act
      const result = service.createGeofence(createGeofenceDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Geofence');
      expect(result.boundary.points.length).toBe(4);
      expect(result.center).toEqual({ latitude: 37.7699, longitude: -122.4144 });
      expect(result.metadata).toEqual({ city: 'San Francisco' });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('When finding geofences by point', () => {
    it('Then should return geofences containing the point', () => {
      // Arrange
      const createGeofenceDto = createTestGeofenceDto();
      const geofence = service.createGeofence(createGeofenceDto);
      
      // Point inside the geofence
      const pointInside: Point = { latitude: 37.7699, longitude: -122.4144 };
      
      // Point outside the geofence
      const pointOutside: Point = { latitude: 38.0, longitude: -123.0 };

      // Act & Assert
      testPointsInGeofence(service, geofence.id, pointInside, pointOutside);
    });
  });

  describe('When finding geofences within radius', () => {
    it('Then should return geofences within the radius', () => {
      // Arrange
      const createGeofenceDto = createTestGeofenceDto();
      const geofence = service.createGeofence(createGeofenceDto);
      
      // Center points for radius search
      const centerNear: Point = { latitude: 37.7700, longitude: -122.4150 };
      const centerFar: Point = { latitude: 38.0, longitude: -123.0 };

      // Act & Assert
      testGeofencesWithinRadius(service, geofence.id, centerNear, centerFar);
    });
  });

  describe('When updating a geofence', () => {
    it('Then should update and return the updated geofence', () => {
      // Arrange
      const createGeofenceDto = createTestGeofenceDto();
      const geofence = service.createGeofence(createGeofenceDto);
      
      const testDto = createTestGeofenceDto();
      const updateGeofenceDto: CreateGeofenceDto = {
        name: 'Updated Geofence',
        boundary: testDto.boundary,
        center: testDto.center,
        metadata: { city: 'San Francisco', updated: true }
      };

      // Act
      const result = service.updateGeofence(geofence.id, updateGeofenceDto);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(geofence.id);
      expect(result?.name).toBe('Updated Geofence');
      expect(result?.metadata).toEqual({ city: 'San Francisco', updated: true });
      expect(result?.createdAt).toEqual(geofence.createdAt);
      // Check that updatedAt is a valid Date object
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it('Then should return undefined when updating a non-existent geofence', () => {
      // Arrange
      const updateGeofenceDto = createTestGeofenceDto();

      // Act
      const result = service.updateGeofence('non-existent-id', updateGeofenceDto);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('When deleting a geofence', () => {
    it('Then should delete the geofence and return true', () => {
      // Arrange
      const createGeofenceDto = createTestGeofenceDto();
      const geofence = service.createGeofence(createGeofenceDto);
      
      // Act
      const result = service.deleteGeofence(geofence.id);
      const deletedGeofence = service.getGeofenceById(geofence.id);

      // Assert
      expect(result).toBe(true);
      expect(deletedGeofence).toBeUndefined();
    });

    it('Then should return false when deleting a non-existent geofence', () => {
      // Act
      const result = service.deleteGeofence('non-existent-id');

      // Assert
      expect(result).toBe(false);
    });
  });
});

// Helper functions to reduce test function size
function testPointsInGeofence(
  service: GeofenceService,
  geofenceId: string,
  pointInside: Point,
  pointOutside: Point
): void {
  // Act
  const resultInside = service.findGeofencesContainingPoint(pointInside);
  const resultOutside = service.findGeofencesContainingPoint(pointOutside);

  // Assert
  expect(resultInside.length).toBeGreaterThan(0);
  expect(resultInside[0].id).toBe(geofenceId);
  expect(resultOutside.length).toBe(0);
}

function testGeofencesWithinRadius(
  service: GeofenceService,
  geofenceId: string,
  centerNear: Point,
  centerFar: Point
): void {
  // Act
  const resultNear = service.findGeofencesWithinRadius(centerNear, 1000); // 1km radius
  const resultFar = service.findGeofencesWithinRadius(centerFar, 1000); // 1km radius

  // Assert
  expect(resultNear.length).toBeGreaterThan(0);
  expect(resultNear[0].id).toBe(geofenceId);
  expect(resultFar.length).toBe(0);
}
