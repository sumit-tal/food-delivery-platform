import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertManagerService } from './alert-manager.service';
import { getBoolean } from '../../../common/utils/config.utils';

/**
 * AlertSeverity enum defines the available alert severity levels.
 */
export enum AlertSeverity {
  CRITICAL = 'critical',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * Alert interface defines the structure of an alert.
 */
export interface Alert {
  name: string;
  summary: string;
  description: string;
  severity: AlertSeverity;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: Date;
  endsAt?: Date;
}

/**
 * AlertingService provides functionality for alerting on critical system conditions.
 * It includes methods for creating and managing alerts.
 */
@Injectable()
export class AlertingService implements OnModuleInit {
  private readonly enabled: boolean;
  private readonly serviceName: string;
  private readonly environment: string;

  public constructor(
    private readonly configService: ConfigService,
    private readonly alertManagerService: AlertManagerService,
  ) {
    this.enabled = getBoolean(this.configService, 'ALERTING_ENABLED', false);
    this.serviceName = this.configService.get<string>('SERVICE_NAME', 'swifteats-backend');
    this.environment = this.configService.get<string>('NODE_ENV', 'development');
  }

  /**
   * Initialize alerting when module starts.
   */
  public onModuleInit(): void {
    if (!this.enabled) {
      return;
    }

    try {
      this.alertManagerService.init();
    } catch (error) {
      console.error('Failed to initialize alerting', error);
    }
  }

  /**
   * Create a new alert.
   * @param name - Alert name
   * @param summary - Alert summary
   * @param description - Alert description
   * @param severity - Alert severity
   * @param labels - Alert labels
   * @param annotations - Alert annotations
   * @returns Alert instance
   */
  public createAlert(
    name: string,
    summary: string,
    description: string,
    severity: AlertSeverity,
    labels: Record<string, string> = {},
    annotations: Record<string, string> = {},
  ): Alert {
    const alert: Alert = {
      name,
      summary,
      description,
      severity,
      labels: {
        ...labels,
        service: this.serviceName,
        environment: this.environment,
        alertname: name,
      },
      annotations: {
        ...annotations,
        summary,
        description,
      },
      startsAt: new Date(),
    };

    if (this.enabled) {
      this.alertManagerService.sendAlert(alert);
    }

    return alert;
  }

  /**
   * Resolve an existing alert.
   * @param alert - Alert to resolve
   */
  public resolveAlert(alert: Alert): void {
    if (!this.enabled) {
      return;
    }

    alert.endsAt = new Date();
    this.alertManagerService.sendAlert(alert);
  }

  /**
   * Create a critical alert.
   * @param name - Alert name
   * @param summary - Alert summary
   * @param description - Alert description
   * @param labels - Alert labels
   * @param annotations - Alert annotations
   * @returns Alert instance
   */
  public createCriticalAlert(
    name: string,
    summary: string,
    description: string,
    labels: Record<string, string> = {},
    annotations: Record<string, string> = {},
  ): Alert {
    return this.createAlert(
      name,
      summary,
      description,
      AlertSeverity.CRITICAL,
      labels,
      annotations,
    );
  }

  /**
   * Create an error alert.
   * @param name - Alert name
   * @param summary - Alert summary
   * @param description - Alert description
   * @param labels - Alert labels
   * @param annotations - Alert annotations
   * @returns Alert instance
   */
  public createErrorAlert(
    name: string,
    summary: string,
    description: string,
    labels: Record<string, string> = {},
    annotations: Record<string, string> = {},
  ): Alert {
    return this.createAlert(name, summary, description, AlertSeverity.ERROR, labels, annotations);
  }

  /**
   * Create a warning alert.
   * @param name - Alert name
   * @param summary - Alert summary
   * @param description - Alert description
   * @param labels - Alert labels
   * @param annotations - Alert annotations
   * @returns Alert instance
   */
  public createWarningAlert(
    name: string,
    summary: string,
    description: string,
    labels: Record<string, string> = {},
    annotations: Record<string, string> = {},
  ): Alert {
    return this.createAlert(name, summary, description, AlertSeverity.WARNING, labels, annotations);
  }

  /**
   * Create an info alert.
   * @param name - Alert name
   * @param summary - Alert summary
   * @param description - Alert description
   * @param labels - Alert labels
   * @param annotations - Alert annotations
   * @returns Alert instance
   */
  public createInfoAlert(
    name: string,
    summary: string,
    description: string,
    labels: Record<string, string> = {},
    annotations: Record<string, string> = {},
  ): Alert {
    return this.createAlert(name, summary, description, AlertSeverity.INFO, labels, annotations);
  }
}
