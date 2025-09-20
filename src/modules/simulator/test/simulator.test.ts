import { Test } from '@nestjs/testing';
import { SimulatorService } from '../services/simulator.service';
import { DriverSimulatorService } from '../services/driver-simulator.service';
import { MovementPatternService } from '../services/movement-pattern.service';
import { VisualizationService } from '../services/visualization.service';
import { ConfigService } from '@nestjs/config';
import { SimulatorConfig } from '../interfaces';

describe('Driver Simulator', () => {
  let simulatorService: SimulatorService;
  let driverSimulatorService: DriverSimulatorService;
  let movementPatternService: MovementPatternService;
  let visualizationService: VisualizationService;

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
        SimulatorService,
        DriverSimulatorService,
        MovementPatternService,
        VisualizationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: any) => {
              switch (key) {
                case 'SIMULATOR_DRIVER_COUNT':
                  return mockConfig.driverCount;
                case 'SIMULATOR_UPDATE_FREQUENCY_MS':
                  return mockConfig.updateFrequencyMs;
                case 'SIMULATOR_AUTO_START':
                  return mockConfig.autoStart;
                case 'SIMULATOR_CENTER_LAT':
                  return mockConfig.initialRegion.centerLat;
                case 'SIMULATOR_CENTER_LNG':
                  return mockConfig.initialRegion.centerLng;
                case 'SIMULATOR_RADIUS_KM':
                  return mockConfig.initialRegion.radiusKm;
                default:
                  return defaultValue;
              }
            }),
          },
        },
      ],
    }).compile();

    simulatorService = moduleRef.get<SimulatorService>(SimulatorService);
    driverSimulatorService = moduleRef.get<DriverSimulatorService>(DriverSimulatorService);
    movementPatternService = moduleRef.get<MovementPatternService>(MovementPatternService);
    visualizationService = moduleRef.get<VisualizationService>(VisualizationService);

    // Mock the methods that interact with external systems
    jest.spyOn(driverSimulatorService, 'sendLocationUpdates').mockImplementation(() => {});
    jest
      .spyOn(visualizationService, 'generateVisualization')
      .mockResolvedValue('/path/to/visualization.html');
    jest.spyOn(visualizationService, 'generateGeoJson').mockResolvedValue('/path/to/data.geojson');

    // Ensure drivers are initialized for tests that require existing drivers
    driverSimulatorService.initialize(mockConfig);
  });

  afterEach(() => {
    // Ensure any running intervals are cleared between tests
    simulatorService.stopSimulation();
    // Always restore real timers in case a test enabled fake timers and failed early
    jest.useRealTimers();
  });

  describe('When initializing the simulator', () => {
    it('Then should create the specified number of drivers', () => {
      // Arrange
      const config = { ...mockConfig, driverCount: 10 };

      // Act
      simulatorService.updateConfig(config);

      // Assert
      expect(driverSimulatorService.getActiveDriverCount()).toBe(10);
    });

    it('Then should use the specified initial region', () => {
      // Arrange
      const spy = jest.spyOn(movementPatternService, 'getRandomPositionInRegion');
      const config = {
        ...mockConfig,
        initialRegion: {
          centerLat: 40.7128,
          centerLng: -74.006,
          radiusKm: 5,
        },
      };

      // Act
      driverSimulatorService.initialize(config);

      // Assert
      expect(spy).toHaveBeenCalledWith(40.7128, -74.006, 5);
    });
  });

  describe('When starting the simulation', () => {
    it('Then should start updating driver locations at the specified frequency', async () => {
      // Arrange
      jest.useFakeTimers();
      const spy = jest.spyOn(driverSimulatorService, 'updateDriverLocations');

      // Act
      await simulatorService.startSimulation();
      jest.advanceTimersByTime(3500); // Advance by 3.5 seconds

      // Assert
      expect(spy).toHaveBeenCalledTimes(3); // Called 3 times with 1000ms interval

      // Cleanup
      jest.useRealTimers();
    });

    it('Then should not start if already running', async () => {
      // Arrange
      const spy = jest.spyOn(simulatorService, 'startSimulation');
      await simulatorService.startSimulation();

      // Act
      await simulatorService.startSimulation();

      // Assert
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.results[1].value).toBeUndefined(); // Second call returns early
    });
  });

  describe('When updating driver locations', () => {
    it('Then should update positions of all drivers', () => {
      // Arrange
      const spy = jest.spyOn(movementPatternService, 'updateDriverPosition');

      // Act
      driverSimulatorService.updateDriverLocations();

      // Assert
      expect(spy).toHaveBeenCalledTimes(mockConfig.driverCount);
    });
  });

  describe('When setting a destination for a driver', () => {
    it('Then should generate a route to the destination', () => {
      // Arrange
      const drivers = driverSimulatorService.getAllDrivers();
      const driver = drivers[0];
      const spy = jest.spyOn(movementPatternService, 'generateRoute');

      // Act
      driverSimulatorService.setDriverDestination(
        driver.id,
        driver.latitude + 0.01,
        driver.longitude + 0.01,
      );

      // Assert
      expect(spy).toHaveBeenCalledWith(
        driver.latitude,
        driver.longitude,
        driver.latitude + 0.01,
        driver.longitude + 0.01,
      );
    });
  });
});
