import type { ConfigService } from '@nestjs/config';

/**
 * Get a boolean config value robustly, correctly parsing common string representations.
 * This prefers raw process.env to avoid implicit boolean coercion done by class-transformer.
 */
export function getBoolean(config: ConfigService, key: string, defaultValue: boolean = false): boolean {
  const rawEnv = process.env[key];
  if (rawEnv !== undefined) {
    const val = rawEnv.trim().toLowerCase();
    if (val === 'true' || val === '1' || val === 'yes' || val === 'y') return true;
    if (val === 'false' || val === '0' || val === 'no' || val === 'n' || val === '') return false;
  }

  const raw: unknown = config.get<unknown>(key);
  if (raw === undefined || raw === null) return defaultValue;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') {
    const val = raw.trim().toLowerCase();
    if (val === 'true' || val === '1' || val === 'yes' || val === 'y') return true;
    if (val === 'false' || val === '0' || val === 'no' || val === 'n' || val === '') return false;
  }
  return defaultValue;
}
