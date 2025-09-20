import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { NotificationEntity } from '../entities/notification.entity';
import { NotificationService } from './notification.service';
import { NotificationPriority, NotificationChannel } from '../interfaces/notification.interface';

/**
 * Service for handling notification queue with prioritization
 */
@Injectable()
@Processor('notifications')
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Add notification to queue with appropriate priority
   * 
   * @param notification - Notification entity
   */
  async addToQueue(notification: NotificationEntity): Promise<void> {
    try {
      // Set job options based on notification priority
      const jobOptions = this.getJobOptionsForPriority(notification.priority);
      
      // Add job to queue for each channel
      for (const channel of notification.channels) {
        await this.notificationsQueue.add(
          'process-notification',
          {
            notificationId: notification.id,
            channel,
          },
          jobOptions,
        );
        
        this.logger.debug(
          `Added notification ${notification.id} to queue for channel ${channel} with priority ${notification.priority}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to add notification to queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get job options based on notification priority
   * 
   * @param priority - Notification priority
   * @returns Job options
   */
  private getJobOptionsForPriority(priority: NotificationPriority): Record<string, any> {
    // Set job options based on priority
    switch (priority) {
      case NotificationPriority.URGENT:
        return {
          priority: 1, // Highest priority
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000, // 1 second
          },
          removeOnComplete: true,
        };
      case NotificationPriority.HIGH:
        return {
          priority: 2,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5 seconds
          },
          removeOnComplete: true,
        };
      case NotificationPriority.NORMAL:
        return {
          priority: 3,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 10000, // 10 seconds
          },
          removeOnComplete: true,
        };
      case NotificationPriority.LOW:
        return {
          priority: 4, // Lowest priority
          attempts: 1,
          delay: 30000, // 30 seconds delay
          removeOnComplete: true,
        };
      default:
        return {
          priority: 3, // Default to normal priority
          attempts: 2,
          removeOnComplete: true,
        };
    }
  }

  /**
   * Process notification job
   * 
   * @param job - Notification job
   */
  @Process('process-notification')
  async processNotification(job: Job<{ notificationId: string; channel: NotificationChannel }>): Promise<void> {
    const { notificationId, channel } = job.data;
    
    try {
      this.logger.debug(`Processing notification ${notificationId} for channel ${channel}`);
      
      // Get notification from repository
      const notification = await this.notificationService.getNotificationById(notificationId);
      
      if (!notification) {
        this.logger.warn(`Notification ${notificationId} not found`);
        return;
      }
      
      // Deliver notification through specified channel
      const result = await this.notificationService.deliverNotification(notification, channel);
      
      if (result.success) {
        this.logger.debug(`Successfully delivered notification ${notificationId} via ${channel}`);
      } else {
        this.logger.warn(`Failed to deliver notification ${notificationId} via ${channel}: ${result.error}`);
        
        // If this was the last attempt, try fallback mechanism
        if (job.attemptsMade >= job.opts.attempts! - 1) {
          await this.handleDeliveryFailure(notification, channel);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing notification ${notificationId} for channel ${channel}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  /**
   * Handle delivery failure with fallback mechanism
   * 
   * @param notification - Notification entity
   * @param failedChannel - Failed channel
   */
  private async handleDeliveryFailure(
    notification: NotificationEntity,
    failedChannel: NotificationChannel,
  ): Promise<void> {
    try {
      this.logger.debug(`Attempting fallback for notification ${notification.id} after ${failedChannel} delivery failure`);
      
      // Implement fallback strategy
      // If a high-priority channel fails, try delivering through a different channel
      if (failedChannel !== NotificationChannel.IN_APP) {
        // Always fall back to in-app notifications
        await this.notificationService.deliverNotification(notification, NotificationChannel.IN_APP);
        this.logger.debug(`Fallback to IN_APP notification for ${notification.id} after ${failedChannel} failure`);
      }
      
      // Update notification with failure information
      await this.notificationService.updateNotificationMetadata(notification.id, {
        deliveryFailures: {
          ...(notification.metadata?.deliveryFailures || {}),
          [failedChannel]: {
            timestamp: new Date().toISOString(),
            fallbackUsed: NotificationChannel.IN_APP,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error handling delivery failure for notification ${notification.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
