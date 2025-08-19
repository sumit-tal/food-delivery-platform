import { IsArray, IsBoolean, IsInt, IsOptional, IsPositive, IsString, Length } from 'class-validator';

/**
 * MenuItemInputDto represents a single menu item payload.
 */
export class MenuItemInputDto {
  @IsString()
  public name!: string;

  @IsOptional()
  @IsString()
  public description?: string;

  @IsInt()
  @IsPositive()
  public priceCents!: number;

  @IsString()
  @Length(3, 3)
  public currency!: string;

  @IsBoolean()
  public isAvailable!: boolean;

  @IsOptional()
  @IsArray()
  public tags?: string[];

  @IsOptional()
  @IsString()
  public imageUrl?: string;
}
