import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum SecurityEventType {
  AUTHENTICATION_SUCCESS = 'AUTH_SUCCESS',
  AUTHENTICATION_FAILURE = 'AUTH_FAILURE',
  AUTHORIZATION_FAILURE = 'AUTHZ_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  ACCOUNT_LOCKOUT = 'ACCOUNT_LOCKOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  API_KEY_ROTATION = 'API_KEY_ROTATION',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
}

export interface SecurityAuditEvent {
  eventType: SecurityEventType;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome: 'SUCCESS' | 'FAILURE';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: Record<string, any>;
  timestamp: Date;
}

export interface SecurityMetrics {
  failedLogins: number;
  rateLimitViolations: number;
  suspiciousActivities: number;
  dataAccessEvents: number;
  privilegeEscalations: number;
  timeWindow: string;
}

/**
 * SecurityAuditService provides comprehensive security event logging and monitoring
 */
@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);
  private readonly securityLogger = new Logger('SECURITY_AUDIT');

  public constructor(private readonly configService: ConfigService) {}

  /**
   * Log a security audit event
   */
  public async logSecurityEvent(event: Partial<SecurityAuditEvent>): Promise<void> {
    const auditEvent: SecurityAuditEvent = {
      eventType: event.eventType!,
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress!,
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      outcome: event.outcome || 'SUCCESS',
      riskLevel: event.riskLevel || 'LOW',
      details: event.details || {},
      timestamp: new Date(),
    };

    // Log to structured logger
    this.securityLogger.log({
      message: `Security Event: ${auditEvent.eventType}`,
      ...auditEvent,
    });

    // Send to external SIEM if configured
    await this.sendToSiem(auditEvent);

    // Check for security alerts
    await this.checkSecurityAlerts(auditEvent);
  }

  /**
   * Log authentication attempt
   */
  public async logAuthenticationAttempt(
    userId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: success ? SecurityEventType.AUTHENTICATION_SUCCESS : SecurityEventType.AUTHENTICATION_FAILURE,
      userId,
      ipAddress,
      userAgent,
      outcome: success ? 'SUCCESS' : 'FAILURE',
      riskLevel: success ? 'LOW' : 'MEDIUM',
      details,
    });
  }

  /**
   * Log authorization failure
   */
  public async logAuthorizationFailure(
    userId: string,
    resource: string,
    action: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.AUTHORIZATION_FAILURE,
      userId,
      resource,
      action,
      ipAddress,
      userAgent,
      outcome: 'FAILURE',
      riskLevel: 'HIGH',
      details,
    });
  }

  /**
   * Log rate limit violation
   */
  public async logRateLimitViolation(
    userId: string | undefined,
    ipAddress: string,
    endpoint: string,
    userAgent: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
      userId,
      resource: endpoint,
      ipAddress,
      userAgent,
      outcome: 'FAILURE',
      riskLevel: 'MEDIUM',
      details,
    });
  }

  /**
   * Log suspicious activity
   */
  public async logSuspiciousActivity(
    userId: string | undefined,
    ipAddress: string,
    activity: string,
    userAgent: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      userId,
      action: activity,
      ipAddress,
      userAgent,
      outcome: 'FAILURE',
      riskLevel: 'HIGH',
      details,
    });
  }

  /**
   * Log data access event
   */
  public async logDataAccess(
    userId: string,
    resource: string,
    action: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.DATA_ACCESS,
      userId,
      resource,
      action,
      ipAddress,
      userAgent,
      outcome: 'SUCCESS',
      riskLevel: 'LOW',
      details,
    });
  }

  /**
   * Log data modification event
   */
  public async logDataModification(
    userId: string,
    resource: string,
    action: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: SecurityEventType.DATA_MODIFICATION,
      userId,
      resource,
      action,
      ipAddress,
      userAgent,
      outcome: 'SUCCESS',
      riskLevel: 'MEDIUM',
      details,
    });
  }

  /**
   * Get security metrics for a time window
   */
  public async getSecurityMetrics(timeWindowHours: number = 24): Promise<SecurityMetrics> {
    // This would typically query a database or log aggregation system
    // For now, return mock data - in a real implementation, this would
    // query your logging infrastructure
    
    return {
      failedLogins: 0,
      rateLimitViolations: 0,
      suspiciousActivities: 0,
      dataAccessEvents: 0,
      privilegeEscalations: 0,
      timeWindow: `${timeWindowHours}h`,
    };
  }

  /**
   * Check for security alert conditions
   */
  private async checkSecurityAlerts(event: SecurityAuditEvent): Promise<void> {
    // Implement alerting logic based on event patterns
    if (event.riskLevel === 'CRITICAL') {
      this.logger.error(`CRITICAL SECURITY EVENT: ${event.eventType}`, event);
      // Send immediate alert to security team
      await this.sendSecurityAlert(event);
    }

    // Check for patterns that might indicate an attack
    if (event.eventType === SecurityEventType.AUTHENTICATION_FAILURE) {
      await this.checkBruteForcePattern(event);
    }
  }

  /**
   * Check for brute force attack patterns
   */
  private async checkBruteForcePattern(event: SecurityAuditEvent): Promise<void> {
    // In a real implementation, this would check recent failed login attempts
    // from the same IP or for the same user and trigger alerts if thresholds are exceeded
    this.logger.debug('Checking brute force patterns', { event });
  }

  /**
   * Send event to external SIEM system
   */
  private async sendToSiem(event: SecurityAuditEvent): Promise<void> {
    const siemEnabled = this.configService.get<boolean>('SIEM_ENABLED', false);
    
    if (!siemEnabled) {
      return;
    }

    try {
      // Implementation would send to your SIEM system (Splunk, ELK, etc.)
      this.logger.debug('Sending event to SIEM', { eventType: event.eventType });
    } catch (error) {
      this.logger.error('Failed to send event to SIEM', error);
    }
  }

  /**
   * Send immediate security alert
   */
  private async sendSecurityAlert(event: SecurityAuditEvent): Promise<void> {
    try {
      // Implementation would send to alerting system (PagerDuty, Slack, etc.)
      this.logger.warn('SECURITY ALERT TRIGGERED', event);
    } catch (error) {
      this.logger.error('Failed to send security alert', error);
    }
  }
}
