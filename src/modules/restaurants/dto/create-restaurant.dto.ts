import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * CreateRestaurantDto validates onboarding payload for a new restaurant.
 */
export class CreateRestaurantDto {
  @IsString()
  public name!: string;

  @IsArray()
  public cuisineTypes!: string[];

  @IsString()
  public city!: string;

  @IsOptional()
  @IsString()
  public area?: string;

  @IsOptional()
  @IsBoolean()
  public isOpen?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  public rating?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  public etaMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  public etaMax?: number;
}
