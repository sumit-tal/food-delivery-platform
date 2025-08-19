import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * GoogleAuthGuard protects routes using the Google OAuth2 strategy.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
