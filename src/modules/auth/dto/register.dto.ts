import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../../common/constants/roles.enum';

export class RegisterDto {
  @IsEmail()
  public email!: string;

  @IsString()
  @MinLength(8)
  public password!: string;

  @IsEnum(UserRole)
  public role!: UserRole;

  @IsString()
  public fullName!: string;

  @IsOptional()
  @IsString()
  public phone?: string;

  @IsOptional()
  @IsString()
  public address?: string;
}
