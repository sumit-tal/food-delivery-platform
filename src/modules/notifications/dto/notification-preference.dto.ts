import { IsString, IsUUID, IsEnum, IsBoolean, IsArray } from 'class-validator';
import { NotificationChannel } from '../interfaces/notification.interface';

/**
 * DTO for updating notification preferences
 */
export class UpdateNotificationPreferenceDto {
  @IsUUID()
  userId!: string;

  @IsString()
  notificationType!: string;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels!: NotificationChannel[];

  @IsBoolean()
  enabled!: boolean;
}

/**
 * DTO for getting notification preferences
 */
export class GetNotificationPreferenceDto {
  @IsUUID()
  userId!: string;

  @IsString()
  notificationType?: string;
}
