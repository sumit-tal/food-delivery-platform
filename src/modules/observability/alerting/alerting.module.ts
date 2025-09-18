import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertingService } from './alerting.service';
import { AlertManagerService } from './alert-manager.service';

/**
 * AlertingModule provides functionality for alerting on critical system conditions.
 * It includes services for alert definition, evaluation, and notification.
 */
@Module({
  imports: [ConfigModule],
  providers: [AlertingService, AlertManagerService],
  exports: [AlertingService, AlertManagerService],
})
export class AlertingModule {}
