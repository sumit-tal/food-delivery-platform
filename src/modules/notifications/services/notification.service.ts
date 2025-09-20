import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEntity } from '../entities/notification.entity';
import {
  NotificationData,
  NotificationStatus,
  NotificationPriority,
  NotificationChannel,
  NotificationDeliveryResult,
} from '../interfaces/notification.interface';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { EmailNotificationService } from './email-notification.service';
import { SmsNotificationService } from './sms-notification.service';
import { PushNotificationService } from './push-notification.service';

/**
 * Main service for handling notifications
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @Inject(forwardRef(() => NotificationQueueService))
    private readonly notificationQueueService: NotificationQueueService,
    private readonly notificationPreferenceService: NotificationPreferenceService,
    private readonly emailNotificationService: EmailNotificationService,
    private readonly smsNotificationService: SmsNotificationService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new notification
   *
   * @param notificationData - Notification data
   * @returns Created notification entity
   */
  async createNotification(notificationData: NotificationData): Promise<NotificationEntity> {
    try {
      // Get user preferences for this notification type
      const userPreferences = await this.notificationPreferenceService.getUserPreferences(
        notificationData.userId,
        notificationData.type,
      );

      // If user has disabled this notification type, don't create it
      if (userPreferences && !userPreferences.enabled) {
        this.logger.debug(
          `User ${notificationData.userId} has disabled notifications of type ${notificationData.type}`,
        );
        throw new Error(
          `Notifications of type ${notificationData.type} are disabled for user ${notificationData.userId}`,
        );
      }

      // Use user's preferred channels if available, otherwise use the provided channels or default to in-app
      const channels = userPreferences?.channels ||
        notificationData.channels || [NotificationChannel.IN_APP];

      // Create notification entity
      const notification = this.notificationRepository.create({
        userId: notificationData.userId,
        title: notificationData.title,
        content: notificationData.content,
        type: notificationData.type,
        priority: notificationData.priority || NotificationPriority.NORMAL,
        channels,
        metadata: notificationData.metadata || {},
        status: NotificationStatus.UNREAD,
      });

      // Save notification to database
      const savedNotification = await this.notificationRepository.save(notification);

      // Queue notification for delivery through selected channels
      await this.queueNotificationDelivery(savedNotification);

      // Emit event for real-time delivery
      this.eventEmitter.emit('notification.created', savedNotification);

      return savedNotification;
    } catch (error) {
      this.logger.error(
        `Failed to create notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Queue notification for delivery through selected channels
   *
   * @param notification - Notification entity
   */
  private async queueNotificationDelivery(notification: NotificationEntity): Promise<void> {
    try {
      // Add to queue with priority
      await this.notificationQueueService.addToQueue(notification);
    } catch (error) {
      this.logger.error(
        `Failed to queue notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Deliver notification through specified channel
   *
   * @param notification - Notification entity
   * @param channel - Notification channel
   * @returns Delivery result
   */
  async deliverNotification(
    notification: NotificationEntity,
    channel: NotificationChannel,
  ): Promise<NotificationDeliveryResult> {
    try {
      const { success, error } = await this.sendThroughChannel(notification, channel);
      if (success) {
        await this.updateDeliveryStatus(notification.id, channel);
      }
      return this.createDeliveryResult({ channel, success, error });
    } catch (err) {
      return this.handleDeliveryError(err, channel);
    }
  }

  private async sendThroughChannel(
    notification: NotificationEntity,
    channel: NotificationChannel,
  ): Promise<{ success: boolean; error?: string }> {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return { success: await this.emailNotificationService.send(notification) };
      case NotificationChannel.SMS:
        return { success: await this.smsNotificationService.send(notification) };
      case NotificationChannel.PUSH:
        return { success: await this.pushNotificationService.send(notification) };
      case NotificationChannel.IN_APP:
        // In-app notifications are delivered via WebSockets by the notification gateway
        return { success: true };
      default:
        return { success: false, error: 'Unsupported notification channel' };
    }
  }

  private createDeliveryResult({
    channel,
    success,
    error,
  }: {
    channel: NotificationChannel;
    success: boolean;
    error?: string;
  }): NotificationDeliveryResult {
    return {
      success,
      channel,
      error,
      timestamp: new Date(),
    };
  }

  private handleDeliveryError(
    err: unknown,
    channel: NotificationChannel,
  ): NotificationDeliveryResult {
    this.logger.error(
      `Failed to deliver notification: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
    return this.createDeliveryResult({
      channel,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  /**
   * Update notification delivery status
   *
   * @param notificationId - Notification ID
   * @param channel - Notification channel
   */
  private async updateDeliveryStatus(
    notificationId: string,
    channel: NotificationChannel,
  ): Promise<void> {
    try {
      await this.notificationRepository.update(
        { id: notificationId },
        {
          isDelivered: true,
          deliveredAt: new Date(),
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to update delivery status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Mark notification as read
   *
   * @param notificationId - Notification ID
   * @param userId - User ID
   * @returns Updated notification
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationEntity> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        throw new Error(`Notification not found: ${notificationId}`);
      }

      notification.status = NotificationStatus.READ;
      notification.readAt = new Date();

      return this.notificationRepository.save(notification);
    } catch (error) {
      this.logger.error(
        `Failed to mark notification as read: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   *
   * @param userId - User ID
   * @returns Number of updated notifications
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await this.notificationRepository.update(
        { userId, status: NotificationStatus.UNREAD },
        {
          status: NotificationStatus.READ,
          readAt: new Date(),
        },
      );

      return result.affected || 0;
    } catch (error) {
      this.logger.error(
        `Failed to mark all notifications as read: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get user notifications with pagination
   *
   * @param userId - User ID
   * @param status - Optional status filter
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated notifications
   */
  async getUserNotifications(
    userId: string,
    status?: NotificationStatus,
    page = 1,
    limit = 10,
  ): Promise<{ notifications: NotificationEntity[]; total: number }> {
    try {
      const queryBuilder = this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.userId = :userId', { userId });

      if (status) {
        queryBuilder.andWhere('notification.status = :status', { status });
      }

      const [notifications, total] = await queryBuilder
        .orderBy('notification.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return { notifications, total };
    } catch (error) {
      this.logger.error(
        `Failed to get user notifications: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   *
   * @param userId - User ID
   * @returns Unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return this.notificationRepository.count({
        where: {
          userId,
          status: NotificationStatus.UNREAD,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get unread count: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Delete a notification
   *
   * @param notificationId - Notification ID
   * @param userId - User ID
   * @returns True if deleted successfully
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.notificationRepository.delete({
        id: notificationId,
        userId,
      });

      const affected: number = result.affected ?? 0;
      return affected > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get notification by ID
   *
   * @param notificationId - Notification ID
   * @returns Notification entity or null if not found
   */
  async getNotificationById(notificationId: string): Promise<NotificationEntity | null> {
    try {
      return this.notificationRepository.findOne({ where: { id: notificationId } });
    } catch (error) {
      this.logger.error(
        `Failed to get notification by ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Update notification metadata
   *
   * @param notificationId - Notification ID
   * @param metadata - Metadata to update
   * @returns Updated notification
   */
  async updateNotificationMetadata(
    notificationId: string,
    metadata: Record<string, any>,
  ): Promise<NotificationEntity> {
    try {
      const notification = await this.getNotificationById(notificationId);

      if (!notification) {
        throw new Error(`Notification not found: ${notificationId}`);
      }

      // Merge existing metadata with new metadata
      notification.metadata = {
        ...notification.metadata,
        ...metadata,
      };

      return this.notificationRepository.save(notification);
    } catch (error) {
      this.logger.error(
        `Failed to update notification metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
