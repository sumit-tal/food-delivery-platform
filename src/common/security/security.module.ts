import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CryptoService } from './crypto.service';
import { PasswordService } from './password.service';
import { RateLimitingService } from './rate-limiting.service';
import { SecurityAuditService } from './security-audit.service';
import { ApiKeyManagementService } from './api-key-management.service';
import { GDPRComplianceService } from './gdpr-compliance.service';
import { SecurityConfigService } from './security-config.service';

/**
 * SecurityModule provides comprehensive security services for the application
 */
@Global()
@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [
    CryptoService,
    PasswordService,
    RateLimitingService,
    SecurityAuditService,
    ApiKeyManagementService,
    GDPRComplianceService,
    SecurityConfigService,
  ],
  exports: [
    CryptoService,
    PasswordService,
    RateLimitingService,
    SecurityAuditService,
    ApiKeyManagementService,
    GDPRComplianceService,
    SecurityConfigService,
  ],
})
export class SecurityModule {}
