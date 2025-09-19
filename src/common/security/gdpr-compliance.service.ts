import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

export interface PersonalDataRequest {
  userId: string;
  requestType: 'ACCESS' | 'RECTIFICATION' | 'ERASURE' | 'PORTABILITY' | 'RESTRICTION';
  requestedBy: string;
  reason?: string;
  specificData?: string[];
}

export interface PersonalDataExport {
  userId: string;
  exportedAt: Date;
  data: {
    profile: any;
    orders: any[];
    payments: any[];
    preferences: any;
    auditLogs: any[];
  };
  format: 'JSON' | 'CSV' | 'XML';
}

export interface DataRetentionPolicy {
  dataType: string;
  retentionPeriodDays: number;
  autoDelete: boolean;
  legalBasis: string;
}

export interface ConsentRecord {
  userId: string;
  consentType: string;
  granted: boolean;
  grantedAt: Date;
  revokedAt?: Date;
  purpose: string;
  legalBasis: string;
  version: string;
}

export interface RiskAssessment {
  dataBreachRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  unauthorizedAccessRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  dataLossRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  mitigationMeasures: string[];
}

export interface PrivacyImpactAssessment {
  assessmentDate: Date;
  dataTypes: string[];
  legalBases: string[];
  retentionPolicies: DataRetentionPolicy[];
  securityMeasures: string[];
  riskAssessment: RiskAssessment;
}

/**
 * GDPRComplianceService handles data protection and privacy compliance
 */
@Injectable()
export class GDPRComplianceService {
  private readonly logger = new Logger(GDPRComplianceService.name);

  // Default data retention policies
  private readonly defaultRetentionPolicies: DataRetentionPolicy[] = [
    {
      dataType: 'user_profile',
      retentionPeriodDays: 2555, // 7 years
      autoDelete: false,
      legalBasis: 'Contract performance',
    },
    {
      dataType: 'order_history',
      retentionPeriodDays: 2555, // 7 years for tax purposes
      autoDelete: false,
      legalBasis: 'Legal obligation',
    },
    {
      dataType: 'payment_data',
      retentionPeriodDays: 2555, // 7 years
      autoDelete: false,
      legalBasis: 'Legal obligation',
    },
    {
      dataType: 'marketing_data',
      retentionPeriodDays: 1095, // 3 years
      autoDelete: true,
      legalBasis: 'Consent',
    },
    {
      dataType: 'analytics_data',
      retentionPeriodDays: 730, // 2 years
      autoDelete: true,
      legalBasis: 'Legitimate interest',
    },
    {
      dataType: 'audit_logs',
      retentionPeriodDays: 2555, // 7 years
      autoDelete: false,
      legalBasis: 'Legal obligation',
    },
  ];

  public constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Process a personal data request (Article 15-20 GDPR)
   */
  public async processPersonalDataRequest(request: PersonalDataRequest): Promise<string> {
    this.logger.log(`Processing GDPR request: ${request.requestType}`, {
      userId: request.userId,
      requestedBy: request.requestedBy,
    });

    const requestId = this.generateRequestId();

    switch (request.requestType) {
      case 'ACCESS':
        await this.handleDataAccessRequest(request, requestId);
        break;
      case 'RECTIFICATION':
        await this.handleDataRectificationRequest(request, requestId);
        break;
      case 'ERASURE':
        await this.handleDataErasureRequest(request, requestId);
        break;
      case 'PORTABILITY':
        await this.handleDataPortabilityRequest(request, requestId);
        break;
      case 'RESTRICTION':
        await this.handleDataRestrictionRequest(request, requestId);
        break;
    }

    return requestId;
  }

  /**
   * Export user's personal data (Article 15 - Right of Access)
   */
  public async exportPersonalData(userId: string, format: 'JSON' | 'CSV' | 'XML' = 'JSON'): Promise<PersonalDataExport> {
    this.logger.log(`Exporting personal data for user ${userId}`);

    // In a real implementation, this would query various services/databases
    const exportData: PersonalDataExport = {
      userId,
      exportedAt: new Date(),
      format,
      data: {
        profile: await this.getUserProfile(userId),
        orders: await this.getUserOrders(userId),
        payments: await this.getUserPayments(userId),
        preferences: await this.getUserPreferences(userId),
        auditLogs: await this.getUserAuditLogs(userId),
      },
    };

    // Log the data export for audit purposes
    await this.logDataExport(userId, exportData);

    return exportData;
  }

  /**
   * Anonymize user data (Article 17 - Right to Erasure)
   */
  public async anonymizeUserData(userId: string, reason: string): Promise<void> {
    this.logger.log(`Anonymizing data for user ${userId}`, { reason });

    // Anonymize personal identifiers while keeping statistical data
    await this.anonymizeUserProfile(userId);
    await this.anonymizeOrderData(userId);
    await this.anonymizePaymentData(userId);
    
    // Log the anonymization for audit purposes
    await this.logDataAnonymization(userId, reason);
  }

  /**
   * Record user consent (Article 7 - Conditions for consent)
   */
  public async recordConsent(
    userId: string,
    consentType: string,
    granted: boolean,
    purpose: string,
    legalBasis: string,
    version: string = '1.0',
  ): Promise<void> {
    const consentRecord: ConsentRecord = {
      userId,
      consentType,
      granted,
      grantedAt: new Date(),
      revokedAt: granted ? undefined : new Date(),
      purpose,
      legalBasis,
      version,
    };

    // Store consent record (in production, use database)
    await this.storeConsentRecord(consentRecord);

    this.logger.log(`Consent ${granted ? 'granted' : 'revoked'}`, {
      userId,
      consentType,
      purpose,
    });
  }

  /**
   * Get user's consent status
   */
  public async getConsentStatus(userId: string, consentType?: string): Promise<ConsentRecord[]> {
    // In production, query from database
    return this.getStoredConsentRecords(userId, consentType);
  }

  /**
   * Apply data retention policies
   */
  public async applyDataRetentionPolicies(): Promise<void> {
    this.logger.log('Applying data retention policies');

    for (const policy of this.defaultRetentionPolicies) {
      if (policy.autoDelete) {
        await this.deleteExpiredData(policy);
      } else {
        await this.flagExpiredData(policy);
      }
    }
  }

  /**
   * Generate privacy impact assessment
   */
  public generatePrivacyImpactAssessment(): PrivacyImpactAssessment {
    return {
      assessmentDate: new Date(),
      dataTypes: this.getProcessedDataTypes(),
      legalBases: this.getLegalBases(),
      retentionPolicies: this.defaultRetentionPolicies,
      securityMeasures: this.getSecurityMeasures(),
      riskAssessment: this.getRiskAssessment(),
    };
  }

  /**
   * Validate data processing lawfulness
   */
  public validateDataProcessing(
    dataType: string,
    purpose: string,
    legalBasis: string,
  ): { isLawful: boolean; reason?: string } {
    const validLegalBases = [
      'Consent',
      'Contract performance',
      'Legal obligation',
      'Vital interests',
      'Public task',
      'Legitimate interest',
    ];

    if (!validLegalBases.includes(legalBasis)) {
      return { isLawful: false, reason: 'Invalid legal basis' };
    }

    // Additional validation logic based on data type and purpose
    if (dataType === 'marketing_data' && legalBasis !== 'Consent') {
      return { isLawful: false, reason: 'Marketing data requires explicit consent' };
    }

    return { isLawful: true };
  }

  // Private helper methods

  private async handleDataAccessRequest(request: PersonalDataRequest, requestId: string): Promise<void> {
    const exportData = await this.exportPersonalData(request.userId);
    // In production, send export data to user or make it available for download
    this.logger.log(`Data access request processed`, { requestId, userId: request.userId });
  }

  private async handleDataRectificationRequest(request: PersonalDataRequest, requestId: string): Promise<void> {
    // Implementation would allow user to update their data
    this.logger.log(`Data rectification request processed`, { requestId, userId: request.userId });
  }

  private async handleDataErasureRequest(request: PersonalDataRequest, requestId: string): Promise<void> {
    await this.anonymizeUserData(request.userId, request.reason || 'User request');
    this.logger.log(`Data erasure request processed`, { requestId, userId: request.userId });
  }

  private async handleDataPortabilityRequest(request: PersonalDataRequest, requestId: string): Promise<void> {
    const exportData = await this.exportPersonalData(request.userId, 'JSON');
    // In production, provide data in a machine-readable format
    this.logger.log(`Data portability request processed`, { requestId, userId: request.userId });
  }

  private async handleDataRestrictionRequest(request: PersonalDataRequest, requestId: string): Promise<void> {
    // Implementation would restrict processing of user's data
    this.logger.log(`Data restriction request processed`, { requestId, userId: request.userId });
  }

  private generateRequestId(): string {
    return `gdpr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getUserProfile(userId: string): Promise<any> {
    // Mock implementation - in production, query user service
    return { id: userId, email: 'user@example.com', name: 'John Doe' };
  }

  private async getUserOrders(userId: string): Promise<any[]> {
    // Mock implementation - in production, query order service
    return [];
  }

  private async getUserPayments(userId: string): Promise<any[]> {
    // Mock implementation - in production, query payment service
    return [];
  }

  private async getUserPreferences(userId: string): Promise<any> {
    // Mock implementation - in production, query preferences service
    return {};
  }

  private async getUserAuditLogs(userId: string): Promise<any[]> {
    // Mock implementation - in production, query audit logs
    return [];
  }

  private async anonymizeUserProfile(userId: string): Promise<void> {
    // Implementation would anonymize user profile data
    this.logger.debug(`Anonymizing user profile for ${userId}`);
  }

  private async anonymizeOrderData(userId: string): Promise<void> {
    // Implementation would anonymize order data
    this.logger.debug(`Anonymizing order data for ${userId}`);
  }

  private async anonymizePaymentData(userId: string): Promise<void> {
    // Implementation would anonymize payment data
    this.logger.debug(`Anonymizing payment data for ${userId}`);
  }

  private async logDataExport(userId: string, exportData: PersonalDataExport): Promise<void> {
    // Log data export for audit trail
    this.logger.log(`Data exported for user ${userId}`, {
      exportedAt: exportData.exportedAt,
      format: exportData.format,
    });
  }

  private async logDataAnonymization(userId: string, reason: string): Promise<void> {
    // Log data anonymization for audit trail
    this.logger.log(`Data anonymized for user ${userId}`, { reason });
  }

  private async storeConsentRecord(record: ConsentRecord): Promise<void> {
    // In production, store in database
    this.logger.debug('Storing consent record', record);
  }

  private async getStoredConsentRecords(userId: string, consentType?: string): Promise<ConsentRecord[]> {
    // In production, query from database
    return [];
  }

  private async deleteExpiredData(policy: DataRetentionPolicy): Promise<void> {
    const cutoffDate = new Date(Date.now() - policy.retentionPeriodDays * 24 * 60 * 60 * 1000);
    this.logger.log(`Deleting expired ${policy.dataType} data older than ${cutoffDate}`);
  }

  private async flagExpiredData(policy: DataRetentionPolicy): Promise<void> {
    const cutoffDate = new Date(Date.now() - policy.retentionPeriodDays * 24 * 60 * 60 * 1000);
    this.logger.log(`Flagging expired ${policy.dataType} data older than ${cutoffDate}`);
  }

  private getProcessedDataTypes(): string[] {
    return ['user_profile', 'order_history', 'payment_data', 'marketing_data', 'analytics_data'];
  }

  private getLegalBases(): string[] {
    return ['Consent', 'Contract performance', 'Legal obligation', 'Legitimate interest'];
  }

  private getSecurityMeasures(): string[] {
    return [
      'AES-256-GCM encryption at rest',
      'TLS 1.3 encryption in transit',
      'Argon2id password hashing',
      'API rate limiting',
      'Security audit logging',
      'Access controls and authentication',
    ];
  }

  private getRiskAssessment(): RiskAssessment {
    return {
      dataBreachRisk: 'LOW',
      unauthorizedAccessRisk: 'LOW',
      dataLossRisk: 'LOW',
      mitigationMeasures: [
        'Regular security audits',
        'Encryption of sensitive data',
        'Access logging and monitoring',
        'Regular backups',
        'Incident response procedures',
      ],
    };
  }
}
