import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationEntity } from '../entities/notification.entity';
import { NotificationCircuitBreakerService } from './notification-circuit-breaker.service';

/**
 * Service for sending SMS notifications
 */
@Injectable()
export class SmsNotificationService {
  private readonly logger = new Logger(SmsNotificationService.name);
  private readonly enabled: boolean;
  private readonly fromNumber: string;
  private readonly circuitId = 'sms';

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: NotificationCircuitBreakerService
  ) {
    this.enabled = this.configService.get<boolean>('NOTIFICATIONS_SMS_ENABLED', false);
    this.fromNumber = this.configService.get<string>('NOTIFICATIONS_SMS_FROM', '+15551234567');
  }

  /**
   * Send an SMS notification
   * 
   * @param notification - Notification entity
   * @returns True if sent successfully
   */
  async send(notification: NotificationEntity): Promise<boolean> {
    try {
      if (!this.enabled) {
        this.logger.warn('SMS notifications are disabled');
        return false;
      }

      // Execute SMS sending with circuit breaker protection
      return await this.circuitBreaker.executeWithCircuitBreaker<boolean>(
        this.circuitId,
        () => this.executeSmsOperation(notification)
      );
    } catch (error) {
      this.logger.error(`Failed to send SMS notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Execute the actual SMS sending logic
   */
  private executeSmsOperation(notification: NotificationEntity): Promise<boolean> {
    return Promise.resolve().then(() => {
      // In a real implementation, this would integrate with an SMS service provider
      // like Twilio, Nexmo, AWS SNS, etc.
      this.logger.debug(`Sending SMS notification to user ${notification.userId}`);
      
      // Simulate SMS sending
      this.logger.debug(`SMS sent: ${JSON.stringify({
        from: this.fromNumber,
        to: `+1555${notification.userId.substring(0, 7)}`, // In real app, get from user profile
        text: `${notification.title}: ${notification.content.substring(0, 140)}...`,
      })}`);
      
      // Uncomment to simulate random failures for testing
      // if (Math.random() < 0.3) {
      //   throw new Error('Simulated SMS service failure');
      // }
      
      return true;
    });
  }
}
