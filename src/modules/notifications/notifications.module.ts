import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ResilienceModule } from '../../common/resilience/resilience.module';

import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationGateway } from './gateways/notification.gateway';
import { EmailNotificationService } from './services/email-notification.service';
import { SmsNotificationService } from './services/sms-notification.service';
import { PushNotificationService } from './services/push-notification.service';
import { NotificationCircuitBreakerService } from './services/notification-circuit-breaker.service';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationPreferenceEntity } from './entities/notification-preference.entity';
import { NotificationTemplateEntity } from './entities/notification-template.entity';

/**
 * NotificationsModule is responsible for handling all notification-related functionality
 * including real-time notifications, email, SMS, and push notifications.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationPreferenceEntity,
      NotificationTemplateEntity,
    ]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    EventEmitterModule.forRoot(),
    ResilienceModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationPreferenceService,
    NotificationTemplateService,
    NotificationQueueService,
    NotificationGateway,
    NotificationCircuitBreakerService,
    EmailNotificationService,
    SmsNotificationService,
    PushNotificationService,
  ],
  exports: [
    NotificationService,
    NotificationPreferenceService,
    NotificationQueueService,
  ],
})
export class NotificationsModule {}
