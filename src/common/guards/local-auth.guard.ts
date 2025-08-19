import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * LocalAuthGuard protects the login route using the local strategy.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
