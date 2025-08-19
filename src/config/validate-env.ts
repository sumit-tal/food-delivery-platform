import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvVariables } from './env-variables';

/**
 * validate validates and transforms raw env config into EnvVariables.
 */
export function validate(config: Record<string, unknown>): EnvVariables {
  const validatedConfig = plainToInstance(EnvVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
