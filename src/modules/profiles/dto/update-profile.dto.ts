import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  public fullName?: string;

  @IsOptional()
  @IsString()
  public phone?: string;

  @IsOptional()
  @IsString()
  public address?: string;
}
