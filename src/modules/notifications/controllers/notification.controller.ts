import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NotificationService } from '../services/notification.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { NotificationTemplateService } from '../services/notification-template.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { UpdateNotificationPreferenceDto, GetNotificationPreferenceDto } from '../dto/notification-preference.dto';
import { CreateNotificationTemplateDto, SendTemplatedNotificationDto } from '../dto/notification-template.dto';
import { NotificationStatus } from '../interfaces/notification.interface';

/**
 * Controller for notification endpoints
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly templateService: NotificationTemplateService,
  ) {}

  /**
   * Create a new notification
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.createNotification(createNotificationDto);
  }

  /**
   * Get user notifications with pagination
   */
  @Get('user/:userId')
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('status') status?: NotificationStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationService.getUserNotifications(
      userId,
      status,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  /**
   * Get unread notification count for a user
   */
  @Get('user/:userId/unread-count')
  async getUnreadCount(@Param('userId') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark a notification as read
   */
  @Patch(':notificationId/read')
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @Body('userId') userId: string,
  ) {
    return this.notificationService.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read for a user
   */
  @Patch('user/:userId/read-all')
  async markAllAsRead(@Param('userId') userId: string) {
    const count = await this.notificationService.markAllAsRead(userId);
    return { count };
  }

  /**
   * Delete a notification
   */
  @Delete(':notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('notificationId') notificationId: string,
    @Body('userId') userId: string,
  ) {
    await this.notificationService.deleteNotification(notificationId, userId);
  }

  /**
   * Get user notification preferences
   */
  @Get('preferences')
  async getUserPreferences(@Body() getPreferenceDto: GetNotificationPreferenceDto) {
    if (getPreferenceDto.notificationType) {
      return this.preferenceService.getUserPreferences(
        getPreferenceDto.userId,
        getPreferenceDto.notificationType,
      );
    }
    
    return this.preferenceService.getAllUserPreferences(getPreferenceDto.userId);
  }

  /**
   * Update user notification preferences
   */
  @Patch('preferences')
  async updateUserPreferences(@Body() updatePreferenceDto: UpdateNotificationPreferenceDto) {
    return this.preferenceService.updateUserPreferences(
      updatePreferenceDto.userId,
      updatePreferenceDto.notificationType,
      updatePreferenceDto.channels,
      updatePreferenceDto.enabled,
    );
  }

  /**
   * Set default notification preferences for a user
   */
  @Post('preferences/default/:userId')
  async setDefaultPreferences(@Param('userId') userId: string) {
    return this.preferenceService.setDefaultPreferences(userId);
  }

  /**
   * Create a notification template
   */
  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(@Body() createTemplateDto: CreateNotificationTemplateDto) {
    return this.templateService.createTemplate(
      createTemplateDto.templateKey,
      createTemplateDto.title,
      createTemplateDto.content,
      createTemplateDto.metadata,
    );
  }

  /**
   * Update a notification template
   */
  @Patch('templates/:templateKey')
  async updateTemplate(
    @Param('templateKey') templateKey: string,
    @Body() updateTemplateDto: CreateNotificationTemplateDto,
  ) {
    return this.templateService.updateTemplate(
      templateKey,
      updateTemplateDto.title,
      updateTemplateDto.content,
      updateTemplateDto.metadata,
    );
  }

  /**
   * Get a notification template
   */
  @Get('templates/:templateKey')
  async getTemplate(@Param('templateKey') templateKey: string) {
    return this.templateService.getTemplate(templateKey);
  }

  /**
   * Delete a notification template
   */
  @Delete('templates/:templateKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Param('templateKey') templateKey: string) {
    await this.templateService.deleteTemplate(templateKey);
  }

  /**
   * Send a notification using a template
   */
  @Post('send-templated')
  async sendTemplatedNotification(@Body() sendTemplatedDto: SendTemplatedNotificationDto) {
    const notificationData = await this.templateService.renderTemplate(
      sendTemplatedDto.templateKey,
      sendTemplatedDto.userId,
      sendTemplatedDto.data,
    );
    
    return this.notificationService.createNotification(notificationData);
  }
}
