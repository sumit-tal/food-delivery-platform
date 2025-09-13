import { SetMetadata } from '@nestjs/common';

/**
 * Decorator for specifying required roles for a route
 * @param roles The roles required to access the route
 * @returns Metadata decorator
 */
export const Roles = (...roles: string[]): ReturnType<typeof SetMetadata> => SetMetadata('roles', roles);
