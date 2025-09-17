import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationEntity } from '../entities/notification.entity';
import { NotificationCircuitBreakerService } from './notification-circuit-breaker.service';

/**
 * Service for sending email notifications
 */
@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private readonly enabled: boolean;
  private readonly fromEmail: string;
  private readonly circuitId = 'email';

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: NotificationCircuitBreakerService
  ) {
    this.enabled = this.configService.get<boolean>('NOTIFICATIONS_EMAIL_ENABLED', false);
    this.fromEmail = this.configService.get<string>('NOTIFICATIONS_EMAIL_FROM', 'noreply@swifteats.com');
  }

  /**
   * Send an email notification
   * 
   * @param notification - Notification entity
   * @returns True if sent successfully
   */
  async send(notification: NotificationEntity): Promise<boolean> {
    try {
      if (!this.enabled) {
        this.logger.warn('Email notifications are disabled');
        return false;
      }

      // Execute email sending with circuit breaker protection
      return await this.circuitBreaker.executeWithCircuitBreaker<boolean>(
        this.circuitId,
        () => this.executeEmailSending(notification)
      );
    } catch (error) {
      this.logger.error(`Failed to send email notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Execute the actual email sending logic
   */
  private executeEmailSending(notification: NotificationEntity): Promise<boolean> {
    return Promise.resolve().then(() => {
      // In a real implementation, this would integrate with an email service provider
      this.logger.debug(`Sending email notification to user ${notification.userId}`);
      
      // Simulate email sending
      this.logger.debug(`Email sent: ${JSON.stringify({
        from: this.fromEmail,
        to: `user-${notification.userId}@example.com`,
        subject: notification.title,
        text: notification.content,
        html: `<h1>${notification.title}</h1><p>${notification.content}</p>`,
      })}`);
      
      // Uncomment to simulate random failures for testing
      // if (Math.random() < 0.3) {
      //   throw new Error('Simulated email service failure');
      // }
      
      return true;
    });
  }

}
