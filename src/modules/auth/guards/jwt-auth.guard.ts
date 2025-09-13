import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for JWT authentication
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
