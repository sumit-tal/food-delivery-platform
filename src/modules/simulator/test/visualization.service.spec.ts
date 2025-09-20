import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { VisualizationService } from '../services/visualization.service';
import type { VirtualDriver } from '../interfaces/virtual-driver.interface';
import type { GeoPoint } from '../interfaces/geo-point.interface';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    heading: number;
    speed: number;
    batteryLevel: number;
    accuracy: number;
    status: string;
  };
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

describe('VisualizationService', () => {
  let service: VisualizationService;
  let mockDrivers: VirtualDriver[];
  let mockGeoPoint: GeoPoint;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock path.join
    mockPath.join.mockImplementation((...args) => args.join('/'));

    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue('/test');

    // Mock fs.existsSync to return false initially (directory doesn't exist)
    mockFs.existsSync.mockReturnValue(false);

    // Mock fs.mkdirSync and fs.writeFileSync to do nothing
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => undefined);

    // Create mock GeoPoint
    mockGeoPoint = {
      latitude: 37.7749,
      longitude: -122.4194,
    };

    // Create mock VirtualDriver data
    mockDrivers = [
      {
        id: 'driver-1',
        latitude: 37.7749,
        longitude: -122.4194,
        heading: 45,
        speed: 25.5,
        accuracy: 5.2,
        batteryLevel: 85.3,
        status: 'available',
        destination: mockGeoPoint,
        route: [mockGeoPoint],
        currentRouteIndex: 0,
      },
      {
        id: 'driver-2',
        latitude: 37.7849,
        longitude: -122.4294,
        heading: 90,
        speed: 30.0,
        accuracy: 3.1,
        batteryLevel: 92.7,
        status: 'en_route',
        destination: null,
        route: [],
        currentRouteIndex: 0,
      },
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [VisualizationService],
    }).compile();

    service = module.get<VisualizationService>(VisualizationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('When constructor is called', () => {
    it('Then should create visualization directory if it does not exist', () => {
      // Reset mocks for this specific test
      jest.clearAllMocks();
      mockFs.existsSync.mockReturnValue(false);

      // Create a new instance to trigger constructor
      new VisualizationService();

      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/visualization');
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/visualization', { recursive: true });
    });

    it('Then should not create directory if it already exists', () => {
      // Reset mocks for this specific test
      jest.clearAllMocks();
      mockFs.existsSync.mockReturnValue(true);

      // Create a new instance to trigger constructor
      new VisualizationService();

      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/visualization');
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('When generateVisualization is called', () => {
    it('Then should generate HTML file and return file path', async () => {
      const result = await service.generateVisualization(mockDrivers);

      expect(result).toContain('driver-visualization-');
      expect(result).toContain('.html');
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).toBe(result);
      expect(writeCall[1]).toContain('<!DOCTYPE html>');
      expect(writeCall[1]).toContain('Driver Simulator Visualization');
    });

    it('Then should handle empty driver array', async () => {
      const result = await service.generateVisualization([]);

      expect(result).toContain('driver-visualization-');
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      expect(writeCall[1]).toContain('Active Drivers: 0');
    });
  });

  describe('When generateGeoJson is called', () => {
    it('Then should generate GeoJSON file and return file path', async () => {
      const result = await service.generateGeoJson(mockDrivers);

      expect(result).toContain('driver-positions-');
      expect(result).toContain('.geojson');
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).toBe(result);

      const geoJsonContent: GeoJsonFeatureCollection = JSON.parse(writeCall[1] as string);
      expect(geoJsonContent.type).toBe('FeatureCollection');
      expect(geoJsonContent.features).toHaveLength(2);
      expect(geoJsonContent.features[0].geometry.type).toBe('Point');
      expect(geoJsonContent.features[0].properties.id).toBe('driver-1');
    });

    it('Then should handle empty driver array', async () => {
      const result = await service.generateGeoJson([]);

      expect(result).toContain('driver-positions-');
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const geoJsonContent: GeoJsonFeatureCollection = JSON.parse(writeCall[1] as string);
      expect(geoJsonContent.features).toHaveLength(0);
    });
  });

  describe('When calculateCenter is called indirectly through generateVisualization', () => {
    it('Then should calculate correct center for multiple drivers', async () => {
      // Mock Date to return consistent timestamp
      const mockDate = new Date('2023-01-01T00:00:00.000Z');
      const originalDate = global.Date;
      global.Date = jest.fn().mockReturnValue(mockDate) as any;

      try {
        await service.generateVisualization(mockDrivers);

        const writeCall = mockFs.writeFileSync.mock.calls[0];
        const htmlContent = writeCall[1] as string;

        // Center should be average of driver positions
        const expectedLat = (37.7749 + 37.7849) / 2;
        const expectedLng = (-122.4194 + -122.4294) / 2;

        expect(htmlContent).toContain(`center: { lat: ${expectedLat}, lng: ${expectedLng} }`);
      } finally {
        global.Date = originalDate;
      }
    });

    it('Then should handle single driver', async () => {
      await service.generateVisualization([mockDrivers[0]]);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const htmlContent = writeCall[1];

      expect(htmlContent).toContain(`center: { lat: ${mockDrivers[0].latitude}, lng: ${mockDrivers[0].longitude} }`);
    });

    it('Then should handle empty array', async () => {
      await service.generateVisualization([]);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const htmlContent = writeCall[1];

      expect(htmlContent).toContain('center: { lat: 0, lng: 0 }');
    });
  });

  describe('When getDriverStatusColor is called indirectly through generateVisualization', () => {
    it('Then should return correct colors for different statuses', async () => {
      const testDrivers: VirtualDriver[] = [
        { ...mockDrivers[0], status: 'available' },
        { ...mockDrivers[1], status: 'en_route' },
        { ...mockDrivers[0], id: 'driver-3', status: 'busy' },
        { ...mockDrivers[0], id: 'driver-4', status: 'offline' },
        { ...mockDrivers[0], id: 'driver-5', status: 'unknown' },
      ];

      await service.generateVisualization(testDrivers);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const htmlContent = writeCall[1];

      expect(htmlContent).toContain("fillColor: '#4CAF50'"); // available - green
      expect(htmlContent).toContain("fillColor: '#2196F3'"); // en_route - blue
      expect(htmlContent).toContain("fillColor: '#FFC107'"); // busy - amber
      expect(htmlContent).toContain("fillColor: '#F44336'"); // offline - red
      expect(htmlContent).toContain("fillColor: '#9E9E9E'"); // unknown - grey
    });
  });

  describe('When HTML generation includes driver markers', () => {
    it('Then should include all driver information in markers', async () => {
      await service.generateVisualization(mockDrivers);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const htmlContent = writeCall[1];

      // Check first driver
      expect(htmlContent).toContain('Driver driver-1');
      expect(htmlContent).toContain(`lat: ${mockDrivers[0].latitude}`);
      expect(htmlContent).toContain(`lng: ${mockDrivers[0].longitude}`);
      expect(htmlContent).toContain(`rotation: ${mockDrivers[0].heading}`);

      // Check second driver
      expect(htmlContent).toContain('Driver driver-2');
      expect(htmlContent).toContain(`lat: ${mockDrivers[1].latitude}`);
      expect(htmlContent).toContain(`lng: ${mockDrivers[1].longitude}`);
      expect(htmlContent).toContain(`rotation: ${mockDrivers[1].heading}`);
    });

    it('Then should include driver info windows with correct data', async () => {
      await service.generateVisualization(mockDrivers);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const htmlContent = writeCall[1];

      // Check info window content
      expect(htmlContent).toContain('Driver driver-1');
      expect(htmlContent).toContain(`Status: ${mockDrivers[0].status}`);
      expect(htmlContent).toContain(`Speed: ${mockDrivers[0].speed.toFixed(1)} km/h`);
      expect(htmlContent).toContain(`Heading: ${mockDrivers[0].heading.toFixed(1)}°`);
      expect(htmlContent).toContain(`Battery: ${mockDrivers[0].batteryLevel.toFixed(1)}%`);
      expect(htmlContent).toContain(`Position: ${mockDrivers[0].latitude.toFixed(5)}, ${mockDrivers[0].longitude.toFixed(5)}`);
    });
  });

  describe('When file operations fail', () => {
    it('Then should throw error if writeFileSync fails', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      await expect(service.generateVisualization(mockDrivers)).rejects.toThrow('File system error');
    });

    it('Then should throw error if GeoJSON writeFileSync fails', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      await expect(service.generateGeoJson(mockDrivers)).rejects.toThrow('File system error');
    });
  });
});
