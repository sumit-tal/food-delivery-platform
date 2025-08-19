import { IsArray, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MenuItemInputDto } from './menu-item-input.dto';

/**
 * UpsertMenuDto validates a full menu replacement with optional optimistic locking.
 */
export class UpsertMenuDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  public expectedVersion?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemInputDto)
  public items!: MenuItemInputDto[];
}
