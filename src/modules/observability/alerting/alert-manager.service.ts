import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { Alert } from './alerting.service';
import { getBoolean } from '../../../common/utils/config.utils';

/**
 * AlertManagerService provides functionality for sending alerts to Prometheus AlertManager.
 * It handles connection to AlertManager and alert sending.
 */
@Injectable()
export class AlertManagerService {
  private readonly enabled: boolean;
  private readonly alertManagerUrl: string;

  public constructor(private readonly configService: ConfigService) {
    this.enabled = getBoolean(this.configService, 'ALERTING_ENABLED', false);
    this.alertManagerUrl = this.configService.get<string>(
      'ALERT_MANAGER_URL',
      'http://localhost:9093/api/v2/alerts',
    );
  }

  /**
   * Initialize AlertManager connection.
   */
  public init(): void {
    if (!this.enabled) {
      return;
    }

    // Test connection to AlertManager
    this.testConnection().catch((error) => {
      console.error('Failed to connect to AlertManager', error);
    });
  }

  /**
   * Test connection to AlertManager.
   */
  private async testConnection(): Promise<void> {
    try {
      await axios.get(this.alertManagerUrl.replace('/api/v2/alerts', '/api/v2/status'));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to AlertManager: ${errorMessage}`);
    }
  }

  /**
   * Send an alert to AlertManager.
   * @param alert - Alert to send
   */
  public async sendAlert(alert: Alert): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const alertPayload = {
        labels: {
          ...alert.labels,
          severity: alert.severity,
        },
        annotations: alert.annotations,
        startsAt: alert.startsAt.toISOString(),
        endsAt: alert.endsAt ? alert.endsAt.toISOString() : null,
      };

      await axios.post(this.alertManagerUrl, [alertPayload]);
    } catch (error: unknown) {
      console.error('Failed to send alert to AlertManager', error);
    }
  }

  /**
   * Get all active alerts from AlertManager.
   * @returns Array of active alerts
   */
  public async getActiveAlerts(): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const response: AxiosResponse = await axios.get(this.alertManagerUrl);
      return response.data as unknown[];
    } catch (error: unknown) {
      console.error('Failed to get active alerts from AlertManager', error);
      return [];
    }
  }

  /**
   * Create matcher for alert silencing.
   * @param alertId - Alert ID to silence
   * @returns Matcher object
   */
  private createAlertMatcher(alertId: string): Record<string, unknown> {
    return {
      name: 'alertname',
      value: alertId,
      isRegex: false,
    };
  }

  /**
   * Calculate start and end times for silence duration.
   * @param duration - Duration in seconds
   * @returns Object with start and end times
   */
  private calculateSilenceTimes(duration: number): { start: Date; end: Date } {
    const start = new Date();
    const end = new Date(start.getTime() + duration * 1000);
    return { start, end };
  }

  /**
   * Create silence payload for AlertManager.
   * @param alertId - Alert ID to silence
   * @param duration - Silence duration in seconds
   * @param comment - Silence comment
   * @returns Silence payload object
   */
  private createSilencePayload(
    alertId: string,
    duration: number,
    comment: string,
  ): Record<string, unknown> {
    const matcher = this.createAlertMatcher(alertId);
    const { start, end } = this.calculateSilenceTimes(duration);

    return {
      matchers: [matcher],
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      createdBy: 'swifteats-backend',
      comment,
    };
  }

  /**
   * Get the silences endpoint URL.
   * @returns Silences endpoint URL
   */
  private getSilencesUrl(): string {
    return this.alertManagerUrl.replace('/api/v2/alerts', '/api/v2/silences');
  }

  /**
   * Silence an alert in AlertManager.
   * @param alertId - Alert ID to silence
   * @param duration - Silence duration in seconds
   * @param comment - Silence comment
   * @returns Silence ID
   */
  public async silenceAlert(
    alertId: string,
    duration: number,
    comment: string,
  ): Promise<string | null> {
    if (!this.enabled) return null;

    return this.trySilenceAlert(alertId, duration, comment);
  }

  /**
   * Try to silence an alert and handle errors.
   * @param alertId - Alert ID to silence
   * @param duration - Silence duration in seconds
   * @param comment - Silence comment
   * @returns Silence ID or null if failed
   */
  private async trySilenceAlert(
    alertId: string,
    duration: number,
    comment: string,
  ): Promise<string | null> {
    try {
      const silencePayload = this.createSilencePayload(alertId, duration, comment);
      return await this.postSilence(silencePayload);
    } catch (error: unknown) {
      console.error('Failed to silence alert in AlertManager', error);
      return null;
    }
  }

  /**
   * Post a silence to AlertManager.
   * @param silencePayload - Silence payload
   * @returns Silence ID
   */
  private async postSilence(silencePayload: Record<string, unknown>): Promise<string> {
    interface SilenceResponse {
      silenceId: string;
    }

    const silencesUrl = this.getSilencesUrl();
    const response: AxiosResponse<SilenceResponse> = await axios.post(silencesUrl, silencePayload);

    return response.data.silenceId;
  }
}
