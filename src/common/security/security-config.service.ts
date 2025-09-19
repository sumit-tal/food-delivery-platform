import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SecurityConfiguration {
  encryption: {
    algorithm: string;
    keySize: number;
    enabled: boolean;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    redisUrl?: string;
  };
  audit: {
    enabled: boolean;
    siemEnabled: boolean;
    siemEndpoint?: string;
  };
  apiKeys: {
    rotationEnabled: boolean;
    defaultExpiryDays: number;
  };
  gdpr: {
    complianceEnabled: boolean;
    dataRetentionEnabled: boolean;
    privacyPolicyVersion: string;
  };
  ssl: {
    enabled: boolean;
    keyPath?: string;
    certPath?: string;
    enforceHttps: boolean;
  };
  headers: {
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    csp: {
      enabled: boolean;
      directives: Record<string, string[]>;
    };
  };
}

export interface ComplianceStatus {
  gdprCompliant: boolean;
  encryptionEnabled: boolean;
  auditingEnabled: boolean;
  rateLimitingEnabled: boolean;
  sslEnabled: boolean;
  overallCompliance: number;
}

export interface SecurityReport {
  configuration: SecurityConfiguration;
  compliance: ComplianceStatus;
  recommendations: string[];
  timestamp: Date;
}

/**
 * SecurityConfigService centralizes security configuration management
 */
@Injectable()
export class SecurityConfigService {
  private readonly logger = new Logger(SecurityConfigService.name);
  private readonly config: SecurityConfiguration;

  public constructor(private readonly configService: ConfigService) {
    this.config = this.loadSecurityConfiguration();
    this.validateConfiguration();
  }

  /**
   * Get the complete security configuration
   */
  public getSecurityConfig(): SecurityConfiguration {
    return { ...this.config };
  }

  /**
   * Get encryption configuration
   */
  public getEncryptionConfig(): SecurityConfiguration['encryption'] {
    return this.config.encryption;
  }

  /**
   * Get rate limiting configuration
   */
  public getRateLimitConfig(): SecurityConfiguration['rateLimit'] {
    return this.config.rateLimit;
  }

  /**
   * Get audit configuration
   */
  public getAuditConfig(): SecurityConfiguration['audit'] {
    return this.config.audit;
  }

  /**
   * Get API key management configuration
   */
  public getApiKeyConfig(): SecurityConfiguration['apiKeys'] {
    return this.config.apiKeys;
  }

  /**
   * Get GDPR compliance configuration
   */
  public getGdprConfig(): SecurityConfiguration['gdpr'] {
    return this.config.gdpr;
  }

  /**
   * Get SSL configuration
   */
  public getSslConfig(): SecurityConfiguration['ssl'] {
    return this.config.ssl;
  }

  /**
   * Get security headers configuration
   */
  public getHeadersConfig(): SecurityConfiguration['headers'] {
    return this.config.headers;
  }

  /**
   * Check if a security feature is enabled
   */
  public isFeatureEnabled(feature: keyof SecurityConfiguration): boolean {
    const featureConfig = this.config[feature];
    if (typeof featureConfig === 'object' && 'enabled' in featureConfig) {
      return featureConfig.enabled;
    }
    return false;
  }

  /**
   * Get security compliance status
   */
  public getComplianceStatus(): ComplianceStatus {
    const complianceFlags = this.extractComplianceFlags();
    const overallCompliance = this.calculateOverallCompliance(complianceFlags);

    return {
      ...complianceFlags,
      overallCompliance,
    };
  }

  /**
   * Generate security report
   */
  public generateSecurityReport(): SecurityReport {
    const compliance = this.getComplianceStatus();
    const recommendations = this.generateRecommendations(compliance);

    return {
      configuration: this.getSecurityConfig(),
      compliance,
      recommendations,
      timestamp: new Date(),
    };
  }

  /**
   * Validate security configuration
   */
  public validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    this.validateEncryptionConfig(errors);
    this.validateRateLimitConfig(errors);
    this.validateSslConfig(errors);
    this.validateJwtConfig(errors);

    const isValid = errors.length === 0;
    this.logValidationResult(isValid, errors);

    return { isValid, errors };
  }

  private loadSecurityConfiguration(): SecurityConfiguration {
    return {
      encryption: this.loadEncryptionConfig(),
      rateLimit: this.loadRateLimitConfig(),
      audit: this.loadAuditConfig(),
      apiKeys: this.loadApiKeysConfig(),
      gdpr: this.loadGdprConfig(),
      ssl: this.loadSslConfig(),
      headers: this.loadHeadersConfig(),
    };
  }

  private extractComplianceFlags(): Omit<ComplianceStatus, 'overallCompliance'> {
    return {
      gdprCompliant: this.config.gdpr.complianceEnabled,
      encryptionEnabled: this.config.encryption.enabled,
      auditingEnabled: this.config.audit.enabled,
      rateLimitingEnabled: this.config.rateLimit.enabled,
      sslEnabled: this.config.ssl.enabled,
    };
  }

  private calculateOverallCompliance(
    complianceFlags: Omit<ComplianceStatus, 'overallCompliance'>,
  ): number {
    const enabledFeatures = Object.values(complianceFlags).filter(Boolean).length;
    return (enabledFeatures / 5) * 100;
  }

  private generateRecommendations(compliance: ComplianceStatus): string[] {
    const recommendations: string[] = [];

    this.addComplianceRecommendations(compliance, recommendations);
    this.addConfigurationRecommendations(recommendations);

    return recommendations;
  }

  private addComplianceRecommendations(
    compliance: ComplianceStatus,
    recommendations: string[],
  ): void {
    if (!compliance.gdprCompliant) {
      recommendations.push('Enable GDPR compliance features to meet data protection requirements');
    }
    if (!compliance.encryptionEnabled) {
      recommendations.push('Enable encryption for data at rest and in transit');
    }
    if (!compliance.auditingEnabled) {
      recommendations.push('Enable security audit logging for compliance and monitoring');
    }
    if (!compliance.rateLimitingEnabled) {
      recommendations.push('Enable rate limiting to prevent abuse and DoS attacks');
    }
    if (!compliance.sslEnabled) {
      recommendations.push('Enable SSL/TLS for secure communications in production');
    }
    if (compliance.overallCompliance < 80) {
      recommendations.push('Overall security compliance is below recommended threshold (80%)');
    }
  }

  private addConfigurationRecommendations(recommendations: string[]): void {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (jwtSecret && jwtSecret.includes('change-me')) {
      recommendations.push('Update JWT_SECRET to a secure, randomly generated value');
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv !== 'production' && this.config.ssl.enabled) {
      recommendations.push('Consider using HTTPS in all environments for consistency');
    }
  }

  private validateEncryptionConfig(errors: string[]): void {
    if (this.config.encryption.enabled) {
      const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
      if (!encryptionKey || encryptionKey.length < 32) {
        errors.push('ENCRYPTION_KEY must be at least 32 characters long');
      }
    }
  }

  private validateRateLimitConfig(errors: string[]): void {
    if (this.config.rateLimit.enabled && !this.config.rateLimit.redisUrl) {
      errors.push('Redis URL is required when rate limiting is enabled');
    }
  }

  private validateSslConfig(errors: string[]): void {
    if (this.config.ssl.enabled) {
      if (!this.config.ssl.keyPath || !this.config.ssl.certPath) {
        errors.push('SSL key and certificate paths are required when SSL is enabled');
      }
    }
  }

  private validateJwtConfig(errors: string[]): void {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret || jwtSecret.includes('change-me')) {
      errors.push('JWT_SECRET must be set to a secure value');
    }
  }

  private logValidationResult(isValid: boolean, errors: string[]): void {
    if (!isValid) {
      this.logger.error('Security configuration validation failed', { errors });
    } else {
      this.logger.log('Security configuration validation passed');
    }
  }

  private loadEncryptionConfig(): SecurityConfiguration['encryption'] {
    return {
      algorithm: 'aes-256-gcm',
      keySize: 32,
      enabled: this.configService.get<boolean>('ENCRYPTION_ENABLED', true),
    };
  }

  private loadRateLimitConfig(): SecurityConfiguration['rateLimit'] {
    return {
      enabled: this.configService.get<boolean>('RATE_LIMIT_ENABLED', true),
      windowMs: this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
      maxRequests: this.configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 100),
      redisUrl:
        this.configService.get<string>('RATE_LIMIT_REDIS_URL') ||
        this.configService.get<string>('REDIS_URL'),
    };
  }

  private loadAuditConfig(): SecurityConfiguration['audit'] {
    return {
      enabled: this.configService.get<boolean>('SECURITY_AUDIT_ENABLED', true),
      siemEnabled: this.configService.get<boolean>('SIEM_ENABLED', false),
      siemEndpoint: this.configService.get<string>('SIEM_ENDPOINT'),
    };
  }

  private loadApiKeysConfig(): SecurityConfiguration['apiKeys'] {
    return {
      rotationEnabled: this.configService.get<boolean>('API_KEY_ROTATION_ENABLED', true),
      defaultExpiryDays: this.configService.get<number>('API_KEY_DEFAULT_EXPIRY_DAYS', 90),
    };
  }

  private loadGdprConfig(): SecurityConfiguration['gdpr'] {
    return {
      complianceEnabled: this.configService.get<boolean>('GDPR_COMPLIANCE_ENABLED', true),
      dataRetentionEnabled: this.configService.get<boolean>('DATA_RETENTION_ENABLED', true),
      privacyPolicyVersion: this.configService.get<string>('PRIVACY_POLICY_VERSION', '1.0'),
    };
  }

  private loadSslConfig(): SecurityConfiguration['ssl'] {
    return {
      enabled: this.configService.get<string>('NODE_ENV') === 'production',
      keyPath: this.configService.get<string>('SSL_KEY_PATH'),
      certPath: this.configService.get<string>('SSL_CERT_PATH'),
      enforceHttps: this.configService.get<boolean>('ENFORCE_HTTPS', true),
    };
  }

  private loadHeadersConfig(): SecurityConfiguration['headers'] {
    return {
      hsts: {
        maxAge: this.configService.get<number>('HSTS_MAX_AGE', 31536000),
        includeSubDomains: this.configService.get<boolean>('HSTS_INCLUDE_SUBDOMAINS', true),
        preload: this.configService.get<boolean>('HSTS_PRELOAD', true),
      },
      csp: {
        enabled: this.configService.get<boolean>('CSP_ENABLED', true),
        directives: this.loadCspDirectives(),
      },
    };
  }

  private loadCspDirectives(): Record<string, string[]> {
    return {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    };
  }
}
