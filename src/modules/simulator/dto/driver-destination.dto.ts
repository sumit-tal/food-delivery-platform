import { IsNumber, Min, Max } from 'class-validator';

/**
 * DTO for setting a driver destination
 */
export class DriverDestinationDto {
  /**
   * Destination latitude
   */
  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly latitude: number = 0;

  /**
   * Destination longitude
   */
  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly longitude: number = 0;
}
