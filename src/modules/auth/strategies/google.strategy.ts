import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import type { Profile, StrategyOptions } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../../common/constants/roles.enum';
import { randomUUID } from 'crypto';

/**
 * GoogleStrategy handles Google OAuth2 login and maps a Google profile to a local user.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  public constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {
    // The constructor type from PassportStrategy mixin uses any for args;
    // cast options and disable the specific unsafe-call for super().
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const clientId = config.get<string>('OAUTH_GOOGLE_CLIENT_ID') || 'dummy-client-id';
    const clientSecret = config.get<string>('OAUTH_GOOGLE_CLIENT_SECRET') || 'dummy-client-secret';

    super({
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: '/api/v1/auth/google/callback',
      scope: ['profile', 'email'],
    } as StrategyOptions);
  }

  /**
   * Validates Google profile, ensures a local user, and returns its id.
   */
  public async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<{ id: string }> {
    // Check if we have valid credentials
    const clientId = this.config.get<string>('OAUTH_GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('OAUTH_GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret || clientId === 'dummy-client-id') {
      throw new Error('Google OAuth is not configured. Please set OAUTH_GOOGLE_CLIENT_ID and OAUTH_GOOGLE_CLIENT_SECRET environment variables.');
    }

    const email: string = this.extractEmail(profile);
    const fullName: string = this.getFullName(profile);
    const userId: string = await this.ensureUser(email, fullName);
    return { id: userId };
  }

  private extractEmail(profile: Profile): string {
    const emailsUnknown: unknown = (profile as { emails?: unknown }).emails;
    if (Array.isArray(emailsUnknown) && emailsUnknown.length > 0) {
      const first: unknown = (emailsUnknown as unknown[])[0];
      if (first && typeof first === 'object' && 'value' in first) {
        const value: unknown = (first as { value?: unknown }).value;
        if (typeof value === 'string' && value.length > 0) {
          return value;
        }
      }
    }
    throw new Error('Google profile does not have an email');
  }

  private getFullName(profile: Profile): string {
    const candidate: unknown = (profile as { displayName?: unknown }).displayName;
    if (typeof candidate === 'string') {
      const trimmed: string = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return 'Google User';
  }

  private async ensureUser(email: string, fullName: string): Promise<string> {
    const existing = this.users.findByEmail(email);
    if (existing) {
      return existing.id;
    }
    const password: string = randomUUID();
    const created = await this.users.create(
      { email, password, role: UserRole.CUSTOMER, fullName },
      (v: string): string => v,
    );
    return created.id;
  }
}
