import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiKeyManagementService } from './api-key-management.service';
import { GDPRComplianceService } from './gdpr-compliance.service';
import { RateLimitingService } from './rate-limiting.service';

/**
 * SecuritySchedulerService handles automated security tasks
 */
@Injectable()
export class SecuritySchedulerService {
  private readonly logger = new Logger(SecuritySchedulerService.name);

  public constructor(
    private readonly apiKeyService: ApiKeyManagementService,
    private readonly gdprService: GDPRComplianceService,
    private readonly rateLimitService: RateLimitingService,
  ) {}

  /**
   * Perform API key rotation check every day at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  public async handleApiKeyRotation(): Promise<void> {
    this.logger.log('Starting scheduled API key rotation check');

    try {
      await this.apiKeyService.performAutomaticRotation();
      this.logger.log('API key rotation check completed');
    } catch (error) {
      this.logger.error('API key rotation check failed', error);
    }
  }

  /**
   * Clean up expired API keys every day at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  public async handleExpiredApiKeyCleanup(): Promise<void> {
    this.logger.log('Starting expired API key cleanup');

    try {
      await this.apiKeyService.cleanupExpiredKeys();
      this.logger.log('Expired API key cleanup completed');
    } catch (error) {
      this.logger.error('Expired API key cleanup failed', error);
    }
  }

  /**
   * Apply data retention policies every Sunday at 1 AM
   */
  @Cron('0 1 * * 0')
  public async handleDataRetention(): Promise<void> {
    this.logger.log('Starting data retention policy application');

    try {
      await this.gdprService.applyDataRetentionPolicies();
      this.logger.log('Data retention policy application completed');
    } catch (error) {
      this.logger.error('Data retention policy application failed', error);
    }
  }

  /**
   * Clean up expired rate limit keys every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  public handleRateLimitCleanup(): void {
    this.logger.debug('Starting rate limit cleanup');

    try {
      this.rateLimitService.cleanupExpiredKeys();
      this.logger.debug('Rate limit cleanup completed');
    } catch (error) {
      this.logger.error('Rate limit cleanup failed', error);
    }
  }

  /**
   * Generate security metrics report every day at 6 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  public async handleSecurityMetricsReport(): Promise<void> {
    this.logger.log('Generating security metrics report');

    try {
      // Generate and log security metrics
      const metrics = {
        timestamp: new Date(),
        apiKeysActive: (await this.apiKeyService.listApiKeys('system')).length,
        privacyImpactAssessment: this.gdprService.generatePrivacyImpactAssessment(),
      };

      this.logger.log('Security metrics report generated', metrics);
    } catch (error) {
      this.logger.error('Security metrics report generation failed', error);
    }
  }
}
