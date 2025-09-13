import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  readonly menuItemId!: string;

  @IsString()
  @IsNotEmpty()
  readonly name!: string;

  @IsString()
  @IsOptional()
  readonly description?: string;

  @IsInt()
  @Min(1)
  readonly quantity!: number;

  @IsInt()
  @Min(0)
  readonly unitPriceCents!: number;

  @IsOptional()
  readonly customizations?: Record<string, unknown>;
}

export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  readonly restaurantId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  readonly items!: OrderItemDto[];

  @IsString()
  @IsNotEmpty()
  readonly deliveryAddress!: string;

  @IsString()
  @IsOptional()
  readonly deliveryInstructions?: string;

  @IsString()
  @IsOptional()
  readonly transactionId?: string;

  @IsString()
  @IsOptional()
  readonly currency?: string = 'USD';
}
