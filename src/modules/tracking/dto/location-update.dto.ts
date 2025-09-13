import { IsUUID, IsNumber, IsOptional, Min, Max, IsDateString } from 'class-validator';

/**
 * DTO for driver location updates
 */
export class LocationUpdateDto {
  /**
   * Driver ID
   */
  @IsUUID()
  readonly driverId!: string;

  /**
   * Latitude
   */
  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly latitude!: number;

  /**
   * Longitude
   */
  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  readonly heading?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  readonly speed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  readonly accuracy?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  readonly batteryLevel?: number;

  @IsOptional()
  @IsUUID()
  readonly orderId?: string;

  @IsOptional()
  @IsDateString()
  readonly timestamp?: string;
}
