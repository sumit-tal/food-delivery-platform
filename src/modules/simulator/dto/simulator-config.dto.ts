import { IsNumber, IsBoolean, IsOptional, Min, Max, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for initial region configuration
 */
export class InitialRegionDto {
  /**
   * Center latitude of the region
   */
  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly centerLat: number = 37.7749;

  /**
   * Center longitude of the region
   */
  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly centerLng: number = -122.4194;

  /**
   * Radius of the region in kilometers
   */
  @IsNumber()
  @Min(0.1)
  @Max(50)
  readonly radiusKm: number = 5;
}

/**
 * DTO for simulator configuration
 */
export class SimulatorConfigDto {
  /**
   * Number of virtual drivers to simulate
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  readonly driverCount?: number;

  /**
   * Update frequency in milliseconds
   */
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(10000)
  readonly updateFrequencyMs?: number;

  /**
   * Whether to automatically start the simulator on initialization
   */
  @IsOptional()
  @IsBoolean()
  readonly autoStart?: boolean;

  /**
   * Initial region for driver placement
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InitialRegionDto)
  readonly initialRegion?: InitialRegionDto;
}
