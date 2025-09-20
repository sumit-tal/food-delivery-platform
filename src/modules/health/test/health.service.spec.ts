import { HealthService } from '../health.service';

describe('When HealthService is invoked', () => {
  let service: HealthService;

  beforeEach(() => {
    service = new HealthService();
  });

  describe('When getLiveness is called', () => {
    it('Then it should return liveness payload with correct structure', () => {
      const result = service.getLiveness();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.status).toBe('string');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });

    it('Then it should return status as "ok"', () => {
      const result = service.getLiveness();

      expect(result.status).toBe('ok');
    });

    it('Then it should return a valid uptime value', () => {
      const result = service.getLiveness();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.uptime)).toBe(true);
    });

    it('Then it should return a valid ISO timestamp', () => {
      const result = service.getLiveness();
      const timestamp = new Date(result.timestamp);

      // Check if timestamp is a valid date and ISO string
      expect(timestamp.toISOString()).toBe(result.timestamp);
      expect(isNaN(timestamp.getTime())).toBe(false);

      // Timestamp should be recent (within last minute)
      const now = Date.now();
      const timeDiff = now - timestamp.getTime();
      expect(timeDiff).toBeGreaterThanOrEqual(0);
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute ago
    });

    it('Then it should return the same object structure consistently', () => {
      const result1 = service.getLiveness();
      const result2 = service.getLiveness();

      // Both should have the same properties
      expect(Object.keys(result1).sort()).toEqual(['status', 'timestamp', 'uptime']);
      expect(Object.keys(result2).sort()).toEqual(['status', 'timestamp', 'uptime']);

      // Status should always be 'ok'
      expect(result1.status).toBe('ok');
      expect(result2.status).toBe('ok');

      // Uptime should be increasing or same (depending on timing)
      expect(result2.uptime).toBeGreaterThanOrEqual(result1.uptime);

      // Timestamps should be different or same (depending on timing)
      expect(typeof result1.timestamp).toBe('string');
      expect(typeof result2.timestamp).toBe('string');
    });
  });
});
