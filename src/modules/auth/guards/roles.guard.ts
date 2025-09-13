import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * User with roles interface
 */
interface UserWithRoles {
  roles: string[];
  [key: string]: unknown;
}

/**
 * Guard for role-based access control
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }
    
    const request = context.switchToHttp().getRequest();
    // Type assertion for the request object
    const user = request?.user as UserWithRoles | undefined;
    
    return !!user && Array.isArray(user.roles) && 
      requiredRoles.some((role) => user.roles.includes(role));
  }
}
