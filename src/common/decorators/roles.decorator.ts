import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../constants/roles.enum';

/**
 * Metadata key for role-based access control.
 */
export const ROLES_KEY: string = 'roles';

/**
 * Roles decorator to declare required roles on a route handler.
 * @param roles Roles permitted to access the endpoint
 */
export function Roles(...roles: readonly UserRole[]): MethodDecorator & ClassDecorator {
  return SetMetadata(ROLES_KEY, roles);
}
