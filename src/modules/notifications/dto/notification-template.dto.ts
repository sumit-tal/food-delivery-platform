import { IsString, IsObject, IsOptional } from 'class-validator';

/**
 * DTO for creating a notification template
 */
export class CreateNotificationTemplateDto {
  @IsString()
  templateKey!: string;

  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

/**
 * DTO for sending a notification using a template
 */
export class SendTemplatedNotificationDto {
  @IsString()
  templateKey!: string;

  @IsString()
  userId!: string;

  @IsObject()
  data!: Record<string, any>;
}
