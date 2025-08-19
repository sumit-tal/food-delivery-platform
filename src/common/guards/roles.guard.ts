import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../constants/roles.enum';

/**
 * RolesGuard authorizes requests based on the required roles declared via the Roles decorator.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredRoles: readonly UserRole[] | undefined = this.reflector.getAllAndOverride<readonly UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request: unknown = context.switchToHttp().getRequest();
    const user: { role: UserRole } | undefined = (request as { user?: { role: UserRole } }).user;
    if (!user) {
      return false;
    }
    return requiredRoles.includes(user.role);
  }
}
