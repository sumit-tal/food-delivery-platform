import { Test, TestingModule } from '@nestjs/testing';
import { SimulatorController } from '../src/modules/simulator/controllers/simulator.controller';
import { SimulatorService } from '../src/modules/simulator/services/simulator.service';
import { DriverSimulatorService } from '../src/modules/simulator/services/driver-simulator.service';
import { VisualizationService } from '../src/modules/simulator/services/visualization.service';
import { SimulatorConfigDto, DriverDestinationDto } from '../src/modules/simulator/dto';

describe('When using SimulatorController', () => {
  let controller: SimulatorController;
  let simulatorService: SimulatorService;
  let driverSimulatorService: DriverSimulatorService;
  let visualizationService: VisualizationService;

  const mockSimulatorService = {
    getStatus: jest.fn(),
    startSimulation: jest.fn(),
    stopSimulation: jest.fn(),
    updateConfig: jest.fn(),
  };

  const mockDriverSimulatorService = {
    getAllDrivers: jest.fn(),
    getDriverById: jest.fn(),
    setDriverDestination: jest.fn(),
  };

  const mockVisualizationService = {
    generateVisualization: jest.fn(),
    generateGeoJson: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SimulatorController],
      providers: [
        {
          provide: SimulatorService,
          useValue: mockSimulatorService,
        },
        {
          provide: DriverSimulatorService,
          useValue: mockDriverSimulatorService,
        },
        {
          provide: VisualizationService,
          useValue: mockVisualizationService,
        },
      ],
    }).compile();

    controller = module.get<SimulatorController>(SimulatorController);
    simulatorService = module.get<SimulatorService>(SimulatorService);
    driverSimulatorService = module.get<DriverSimulatorService>(DriverSimulatorService);
    visualizationService = module.get<VisualizationService>(VisualizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When getting simulator status', () => {
    const mockStatus = {
      isRunning: true,
      config: {
        driverCount: 10,
        updateFrequencyMs: 1000,
        autoStart: false,
        initialRegion: {
          centerLat: 37.7749,
          centerLng: -122.4194,
          radiusKm: 5,
        },
      } as SimulatorConfigDto,
      activeDrivers: 8,
    };

    it('Then should return the simulator status', () => {
      // Arrange
      mockSimulatorService.getStatus.mockReturnValue(mockStatus);

      // Act
      const result = controller.getStatus();

      // Assert
      expect(result).toEqual(mockStatus);
      expect(simulatorService.getStatus).toHaveBeenCalled();
    });
  });

  describe('When starting the simulator', () => {
    it('Then should start the simulation and return success message', async () => {
      // Arrange
      mockSimulatorService.startSimulation.mockResolvedValue(undefined);
      const expectedResult = { message: 'Simulator started successfully' };

      // Act
      const result = await controller.startSimulator();

      // Assert
      expect(result).toEqual(expectedResult);
      expect(simulatorService.startSimulation).toHaveBeenCalled();
    });
  });

  describe('When stopping the simulator', () => {
    it('Then should stop the simulation and return success message', () => {
      // Arrange
      mockSimulatorService.stopSimulation.mockReturnValue(undefined);
      const expectedResult = { message: 'Simulator stopped successfully' };

      // Act
      const result = controller.stopSimulator();

      // Assert
      expect(result).toEqual(expectedResult);
      expect(simulatorService.stopSimulation).toHaveBeenCalled();
    });
  });

  describe('When updating simulator configuration', () => {
    const configDto: SimulatorConfigDto = {
      driverCount: 15,
      updateFrequencyMs: 2000,
      autoStart: true,
      initialRegion: {
        centerLat: 40.7128,
        centerLng: -74.006,
        radiusKm: 10,
      },
    };

    it('Then should update the configuration and return success message', () => {
      // Arrange
      mockSimulatorService.updateConfig.mockReturnValue(undefined);
      const expectedResult = { message: 'Configuration updated successfully' };

      // Act
      const result = controller.updateConfig(configDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(simulatorService.updateConfig).toHaveBeenCalledWith(configDto);
    });
  });

  describe('When getting all drivers', () => {
    const mockDrivers = [
      {
        id: 'driver-1',
        latitude: 37.7749,
        longitude: -122.4194,
        heading: 45,
        speed: 25,
        batteryLevel: 85,
        accuracy: 5,
        status: 'active',
      },
      {
        id: 'driver-2',
        latitude: 37.7849,
        longitude: -122.4294,
        heading: 90,
        speed: 30,
        batteryLevel: 92,
        accuracy: 3,
        status: 'active',
      },
    ];

    it('Then should return all drivers', () => {
      // Arrange
      mockDriverSimulatorService.getAllDrivers.mockReturnValue(mockDrivers);

      // Act
      const result = controller.getAllDrivers();

      // Assert
      expect(result).toEqual(mockDrivers);
      expect(driverSimulatorService.getAllDrivers).toHaveBeenCalled();
    });
  });

  describe('When getting a driver by ID', () => {
    const driverId = 'driver-1';
    const mockDriver = {
      id: driverId,
      latitude: 37.7749,
      longitude: -122.4194,
      heading: 45,
      speed: 25,
      batteryLevel: 85,
      accuracy: 5,
      status: 'active',
    };

    it('Then should return the driver when found', () => {
      // Arrange
      mockDriverSimulatorService.getDriverById.mockReturnValue(mockDriver);

      // Act
      const result = controller.getDriverById(driverId);

      // Assert
      expect(result).toEqual(mockDriver);
      expect(driverSimulatorService.getDriverById).toHaveBeenCalledWith(driverId);
    });

    it('Then should return undefined when driver not found', () => {
      // Arrange
      mockDriverSimulatorService.getDriverById.mockReturnValue(undefined);

      // Act
      const result = controller.getDriverById('non-existent-driver');

      // Assert
      expect(result).toBeUndefined();
      expect(driverSimulatorService.getDriverById).toHaveBeenCalledWith('non-existent-driver');
    });
  });

  describe('When setting a driver destination', () => {
    const driverId = 'driver-1';
    const destinationDto: DriverDestinationDto = {
      latitude: 40.7128,
      longitude: -74.006,
    };

    it('Then should set destination successfully when driver exists', () => {
      // Arrange
      mockDriverSimulatorService.setDriverDestination.mockReturnValue(true);
      const expectedResult = { message: 'Destination set successfully' };

      // Act
      const result = controller.setDriverDestination(driverId, destinationDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(driverSimulatorService.setDriverDestination).toHaveBeenCalledWith(
        driverId,
        destinationDto.latitude,
        destinationDto.longitude,
      );
    });

    it('Then should return error message when driver not found', () => {
      // Arrange
      mockDriverSimulatorService.setDriverDestination.mockReturnValue(false);
      const expectedResult = { message: 'Driver not found' };

      // Act
      const result = controller.setDriverDestination('non-existent-driver', destinationDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(driverSimulatorService.setDriverDestination).toHaveBeenCalledWith(
        'non-existent-driver',
        destinationDto.latitude,
        destinationDto.longitude,
      );
    });
  });

  describe('When generating visualization', () => {
    const mockDrivers = [
      {
        id: 'driver-1',
        latitude: 37.7749,
        longitude: -122.4194,
        heading: 45,
        speed: 25,
        batteryLevel: 85,
        accuracy: 5,
        status: 'active',
      },
    ];
    const mockFilePath = '/path/to/visualization.png';

    it('Then should generate and return visualization file path', async () => {
      // Arrange
      mockDriverSimulatorService.getAllDrivers.mockReturnValue(mockDrivers);
      mockVisualizationService.generateVisualization.mockResolvedValue(mockFilePath);
      const expectedResult = { visualizationPath: mockFilePath };

      // Act
      const result = await controller.generateVisualization();

      // Assert
      expect(result).toEqual(expectedResult);
      expect(driverSimulatorService.getAllDrivers).toHaveBeenCalled();
      expect(visualizationService.generateVisualization).toHaveBeenCalledWith(mockDrivers);
    });
  });

  describe('When generating GeoJSON', () => {
    const mockDrivers = [
      {
        id: 'driver-1',
        latitude: 37.7749,
        longitude: -122.4194,
        heading: 45,
        speed: 25,
        batteryLevel: 85,
        accuracy: 5,
        status: 'active',
      },
    ];
    const mockFilePath = '/path/to/drivers.geojson';

    it('Then should generate and return GeoJSON file path', async () => {
      // Arrange
      mockDriverSimulatorService.getAllDrivers.mockReturnValue(mockDrivers);
      mockVisualizationService.generateGeoJson.mockResolvedValue(mockFilePath);
      const expectedResult = { geoJsonPath: mockFilePath };

      // Act
      const result = await controller.generateGeoJson();

      // Assert
      expect(result).toEqual(expectedResult);
      expect(driverSimulatorService.getAllDrivers).toHaveBeenCalled();
      expect(visualizationService.generateGeoJson).toHaveBeenCalledWith(mockDrivers);
    });
  });
});
