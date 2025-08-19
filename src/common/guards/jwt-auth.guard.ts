import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard protects routes using the JWT strategy.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
