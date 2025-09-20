/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import type { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { AlertManagerService } from 'src/modules/observability/alerting/alert-manager.service';
import { AlertSeverity } from 'src/modules/observability/alerting/alerting.service';
import type { Alert } from 'src/modules/observability/alerting/alerting.service';

jest.mock('axios');

type AxiosMock = jest.Mocked<typeof axios>;

interface MockConfigOptions {
  readonly enabled: boolean;
  readonly url?: string;
}

const DEFAULT_URL = 'http://localhost:9093/api/v2/alerts';

function createMockConfigService(options: MockConfigOptions): ConfigService {
  const values: Record<string, string | boolean> = {
    ALERTING_ENABLED: options.enabled,
    ALERT_MANAGER_URL: options.url ?? DEFAULT_URL,
  };
  return {
    get: <T = string>(key: string, defaultValue?: T): T => {
      const val = values[key];
      return (val as T) ?? (defaultValue as T);
    },
  } as unknown as ConfigService;
}

function buildAlert(overrides: Partial<Alert> = {}): Alert {
  const now = new Date('2024-01-01T00:00:00.000Z');
  const defaults: Alert = {
    name: 'TestAlert',
    summary: 'Test Summary',
    description: 'Test Description',
    severity: AlertSeverity.ERROR,
    labels: { foo: 'bar', alertname: 'TestAlert' },
    annotations: { note: 'n1', summary: 'Test Summary', description: 'Test Description' },
    startsAt: now,
  };
  return { ...defaults, ...overrides };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
}

describe('AlertManagerService', () => {
  let axiosMock: AxiosMock;

  beforeEach(() => {
    axiosMock = axios as AxiosMock;
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('init', () => {
    it('should do nothing when alerting is disabled', async () => {
      const config = createMockConfigService({ enabled: false });
      const service = new AlertManagerService(config);
      service.init();
      await flushPromises();
      expect(axiosMock.get).not.toHaveBeenCalled();
    });

    it('should call AlertManager status endpoint when enabled (success path)', async () => {
      const config = createMockConfigService({
        enabled: true,
        url: 'http://am:9093/api/v2/alerts',
      });
      const service = new AlertManagerService(config);
      axiosMock.get.mockResolvedValueOnce({ data: {} } as AxiosResponse);
      service.init();
      await flushPromises();
      expect(axiosMock.get).toHaveBeenCalledWith('http://am:9093/api/v2/status');
    });

    it('should catch and log connection errors', async () => {
      const config = createMockConfigService({ enabled: true });
      const service = new AlertManagerService(config);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      axiosMock.get.mockRejectedValueOnce(new Error('connect ETIMEDOUT'));
      service.init();
      await flushPromises();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to connect to AlertManager',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('sendAlert', () => {
    it('should not post when disabled', async () => {
      const config = createMockConfigService({ enabled: false });
      const service = new AlertManagerService(config);
      await service.sendAlert(buildAlert());
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

    it('should post alert payload when enabled', async () => {
      const url = 'http://am:9093/api/v2/alerts';
      const config = createMockConfigService({ enabled: true, url });
      const service = new AlertManagerService(config);
      const alert = buildAlert({ endsAt: new Date('2024-01-01T01:00:00.000Z') });
      axiosMock.post.mockResolvedValueOnce({ data: {} } as AxiosResponse);
      await service.sendAlert(alert);
      expect(axiosMock.post).toHaveBeenCalledTimes(1);
      const [calledUrl, body] = axiosMock.post.mock.calls[0];
      expect(calledUrl).toBe(url);
      expect(Array.isArray(body)).toBe(true);
      const [payload] = body as Array<Record<string, unknown>>;
      expect(payload.labels).toMatchObject({ ...alert.labels, severity: alert.severity });
      expect(payload.annotations).toMatchObject(alert.annotations);
      expect(payload.startsAt).toBe('2024-01-01T00:00:00.000Z');
      expect(payload.endsAt).toBe('2024-01-01T01:00:00.000Z');
    });

    it('should log and swallow errors from axios', async () => {
      const config = createMockConfigService({ enabled: true });
      const service = new AlertManagerService(config);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      axiosMock.post.mockRejectedValueOnce(new Error('network error'));
      await expect(service.sendAlert(buildAlert())).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send alert to AlertManager',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getActiveAlerts', () => {
    it('should return empty array when disabled', async () => {
      const config = createMockConfigService({ enabled: false });
      const service = new AlertManagerService(config);
      await expect(service.getActiveAlerts()).resolves.toEqual([]);
      expect(axiosMock.get).not.toHaveBeenCalled();
    });

    it('should return data when enabled and request succeeds', async () => {
      const url = 'http://am:9093/api/v2/alerts';
      const config = createMockConfigService({ enabled: true, url });
      const service = new AlertManagerService(config);
      const data = [{ id: 'a1' }];
      axiosMock.get.mockResolvedValueOnce({ data } as AxiosResponse);
      await expect(service.getActiveAlerts()).resolves.toEqual(data);
      expect(axiosMock.get).toHaveBeenCalledWith(url);
    });

    it('should log error and return empty array on failure', async () => {
      const config = createMockConfigService({ enabled: true });
      const service = new AlertManagerService(config);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      axiosMock.get.mockRejectedValueOnce(new Error('boom'));
      await expect(service.getActiveAlerts()).resolves.toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get active alerts from AlertManager',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('silenceAlert', () => {
    it('should return null when disabled', async () => {
      const config = createMockConfigService({ enabled: false });
      const service = new AlertManagerService(config);
      await expect(service.silenceAlert('Alert1', 600, 'maintenance')).resolves.toBeNull();
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

    it('should post to silences endpoint and return silenceId when enabled', async () => {
      const url = 'http://am:9093/api/v2/alerts';
      const config = createMockConfigService({ enabled: true, url });
      const service = new AlertManagerService(config);
      const silencesUrl = url.replace('/api/v2/alerts', '/api/v2/silences');
      axiosMock.post.mockResolvedValueOnce({ data: { silenceId: 'sil-123' } } as AxiosResponse);
      const result = await service.silenceAlert('Alert1', 300, 'maintenance');
      expect(result).toBe('sil-123');
      expect(axiosMock.post).toHaveBeenCalledTimes(1);
      const [calledUrl, payload] = axiosMock.post.mock.calls[0];
      expect(calledUrl).toBe(silencesUrl);
      expect(payload as Record<string, unknown>).toMatchObject({
        createdBy: 'swifteats-backend',
        comment: 'maintenance',
      });
      const matchers =
        ((payload as Record<string, unknown>).matchers as Array<Record<string, unknown>>) ?? [];
      expect(Array.isArray(matchers)).toBe(true);
      expect(matchers[0]).toMatchObject({ name: 'alertname', value: 'Alert1', isRegex: false });
      expect(typeof (payload as Record<string, unknown>).startsAt).toBe('string');
      expect(typeof (payload as Record<string, unknown>).endsAt).toBe('string');
    });

    it('should log error and return null on failure', async () => {
      const config = createMockConfigService({ enabled: true });
      const service = new AlertManagerService(config);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      axiosMock.post.mockRejectedValueOnce(new Error('bad request'));
      const result = await service.silenceAlert('AlertX', 60, 'temp');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to silence alert in AlertManager',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });
});
