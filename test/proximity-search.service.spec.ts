import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ProximitySearchService } from '../src/modules/geofencing/services/proximity-search.service';
import type { LocationEntity, ProximitySearchResult } from '../src/modules/geofencing/services/proximity-search.service';
import type { ProximitySearchDto } from '../src/modules/geofencing/dto/proximity-search.dto';
import type { Point } from '../src/modules/geofencing/interfaces';

describe('ProximitySearchService', () => {
  let service: ProximitySearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProximitySearchService],
    }).compile();

    service = module.get<ProximitySearchService>(ProximitySearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('When calculating distance between two points', () => {
    it('Then should return the correct distance', () => {
      // Arrange
      const point1: Point = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
      const point2: Point = { latitude: 34.0522, longitude: -118.2437 }; // Los Angeles
      
      // Act
      const distance: number = service.calculateDistance(point1, point2);
      
      // Assert
      // Distance between SF and LA is approximately 559 km or 559,000 meters
      expect(distance).toBeGreaterThan(550000);
      expect(distance).toBeLessThan(570000);
    });
  });

  describe('When finding entities within radius', () => {
    it('Then should return entities sorted by distance', () => {
      // Arrange
      const center: Point = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
      
      const entities: LocationEntity[] = [
        {
          id: '1',
          location: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco (0 km)
          name: 'Entity 1'
        },
        {
          id: '2',
          location: { latitude: 37.8044, longitude: -122.2712 }, // Oakland (10 km)
          name: 'Entity 2'
        },
        {
          id: '3',
          location: { latitude: 37.3382, longitude: -121.8863 }, // San Jose (70 km)
          name: 'Entity 3'
        },
        {
          id: '4',
          location: { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles (559 km)
          name: 'Entity 4'
        }
      ];
      
      const searchParams: ProximitySearchDto = {
        location: center,
        radius: 100000, // 100 km
        limit: 3
      };
      
      // Act
      const results: ProximitySearchResult<LocationEntity>[] = 
        service.findEntitiesWithinRadius(entities, searchParams);
      
      // Assert
      expect(results.length).toBe(3); // Limited to 3 results
      expect(results[0].entity.id).toBe('1'); // Closest first
      expect(results[1].entity.id).toBe('2');
      expect(results[2].entity.id).toBe('3');
      expect(results.find(r => r.entity.id === '4')).toBeUndefined(); // Outside radius
      
      // Check distances
      expect(results[0].distance).toBeLessThan(results[1].distance);
      expect(results[1].distance).toBeLessThan(results[2].distance);
    });

    it('Then should respect the radius limit', () => {
      // Arrange
      const center: Point = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
      
      const entities: LocationEntity[] = [
        {
          id: '1',
          location: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco (0 km)
          name: 'Entity 1'
        },
        {
          id: '2',
          location: { latitude: 37.8044, longitude: -122.2712 }, // Oakland (10 km)
          name: 'Entity 2'
        },
        {
          id: '3',
          location: { latitude: 37.3382, longitude: -121.8863 }, // San Jose (70 km)
          name: 'Entity 3'
        }
      ];
      
      const searchParams: ProximitySearchDto = {
        location: center,
        radius: 20000, // 20 km
        limit: 10
      };
      
      // Act
      const results: ProximitySearchResult<LocationEntity>[] = 
        service.findEntitiesWithinRadius(entities, searchParams);
      
      // Assert
      expect(results.length).toBe(2); // Only 2 entities within 20 km
      expect(results[0].entity.id).toBe('1');
      expect(results[1].entity.id).toBe('2');
      expect(results.find(r => r.entity.id === '3')).toBeUndefined(); // Outside radius
    });

    it('Then should handle empty entity list', () => {
      // Arrange
      const center: Point = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
      const entities: LocationEntity[] = [];
      
      const searchParams: ProximitySearchDto = {
        location: center,
        radius: 100000, // 100 km
        limit: 10
      };
      
      // Act
      const results: ProximitySearchResult<LocationEntity>[] = 
        service.findEntitiesWithinRadius(entities, searchParams);
      
      // Assert
      expect(results).toEqual([]);
    });
  });
});
