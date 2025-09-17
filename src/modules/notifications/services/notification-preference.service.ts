import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreferenceEntity } from '../entities/notification-preference.entity';
import { NotificationChannel } from '../interfaces/notification.interface';

/**
 * Service for managing user notification preferences
 */
@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(
    @InjectRepository(NotificationPreferenceEntity)
    private readonly preferenceRepository: Repository<NotificationPreferenceEntity>,
  ) {}

  /**
   * Get user preferences for a specific notification type
   *
   * @param userId - User ID
   * @param notificationType - Notification type
   * @returns User preferences or null if not found
   */
  async getUserPreferences(
    userId: string,
    notificationType: string,
  ): Promise<NotificationPreferenceEntity | null> {
    try {
      return this.preferenceRepository.findOne({
        where: { userId, notificationType },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get all preferences for a user
   *
   * @param userId - User ID
   * @returns Array of user preferences
   */
  async getAllUserPreferences(userId: string): Promise<NotificationPreferenceEntity[]> {
    try {
      return this.preferenceRepository.find({
        where: { userId },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get all user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Create or update preference entity
   *
   * @param userId - User ID
   * @param notificationType - Notification type
   * @param channels - Notification channels
   * @param enabled - Whether notifications are enabled
   * @returns Preference entity
   */
  private createOrUpdatePreference(
    userId: string,
    notificationType: string,
    channels: NotificationChannel[],
    enabled: boolean,
    existingPreference?: NotificationPreferenceEntity | null,
  ): NotificationPreferenceEntity {
    if (existingPreference) {
      existingPreference.channels = channels;
      existingPreference.enabled = enabled;
      return existingPreference;
    }

    return this.preferenceRepository.create({
      userId,
      notificationType,
      channels,
      enabled,
    });
  }

  /**
   * Update user preferences for a notification type
   *
   * @param userId - User ID
   * @param notificationType - Notification type
   * @param channels - Notification channels
   * @param enabled - Whether notifications are enabled
   * @returns Updated preferences
   */
  async updateUserPreferences(
    userId: string,
    notificationType: string,
    channels: NotificationChannel[],
    enabled: boolean,
  ): Promise<NotificationPreferenceEntity> {
    try {
      const existingPreference = await this.getUserPreferences(userId, notificationType);
      const preference = this.createOrUpdatePreference(
        userId,
        notificationType,
        channels,
        enabled,
        existingPreference,
      );
      return this.preferenceRepository.save(preference);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to update user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get default preferences configuration
   *
   * @returns Array of default preference configurations
   */
  private getDefaultPreferencesConfig(): Array<{
    notificationType: string;
    channels: NotificationChannel[];
    enabled: boolean;
  }> {
    const inAppEmail = [NotificationChannel.IN_APP, NotificationChannel.EMAIL];
    const inAppPush = [NotificationChannel.IN_APP, NotificationChannel.PUSH];
    const inAppOnly = [NotificationChannel.IN_APP];

    return [
      { notificationType: 'order_status', channels: inAppEmail, enabled: true },
      { notificationType: 'driver_updates', channels: inAppPush, enabled: true },
      { notificationType: 'payment_updates', channels: inAppEmail, enabled: true },
      { notificationType: 'promotions', channels: inAppOnly, enabled: true },
    ];
  }

  /**
   * Set default preferences for a user
   *
   * @param userId - User ID
   * @returns Array of created preferences
   */
  async setDefaultPreferences(userId: string): Promise<NotificationPreferenceEntity[]> {
    try {
      const defaultPreferences = this.getDefaultPreferencesConfig();
      const promises = defaultPreferences.map((pref) =>
        this.updateUserPreferences(userId, pref.notificationType, pref.channels, pref.enabled),
      );

      return Promise.all(promises);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to set default preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Delete user preferences
   *
   * @param userId - User ID
   * @param notificationType - Optional notification type
   * @returns True if deleted successfully
   */
  async deleteUserPreferences(userId: string, notificationType?: string): Promise<boolean> {
    try {
      const query: { userId: string; notificationType?: string } = { userId };

      if (notificationType) {
        query.notificationType = notificationType;
      }

      const result = await this.preferenceRepository.delete(query);

      return (result.affected ?? 0) > 0;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to delete user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
