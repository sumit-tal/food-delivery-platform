import { IsString, IsUUID, IsEnum, IsOptional, IsObject, IsArray } from 'class-validator';
import { NotificationPriority, NotificationChannel } from '../interfaces/notification.interface';

/**
 * DTO for creating a new notification
 */
export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsString()
  type!: string;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  @IsOptional()
  channels?: NotificationChannel[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
