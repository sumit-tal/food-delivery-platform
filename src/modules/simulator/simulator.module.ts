import { Module } from '@nestjs/common';
import { SimulatorService } from './services/simulator.service';
import { SimulatorController } from './controllers/simulator.controller';
import { DriverSimulatorService } from './services/driver-simulator.service';
import { MovementPatternService } from './services/movement-pattern.service';
import { VisualizationService } from './services/visualization.service';
import { ConfigModule } from '@nestjs/config';
import { TrackingModule } from '../tracking/tracking.module';

/**
 * Module for driver simulator functionality
 */
@Module({
  imports: [
    ConfigModule,
    TrackingModule,
  ],
  controllers: [SimulatorController],
  providers: [
    SimulatorService,
    DriverSimulatorService,
    MovementPatternService,
    VisualizationService,
  ],
  exports: [SimulatorService],
})
export class SimulatorModule {}
