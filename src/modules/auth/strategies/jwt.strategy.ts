import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '../../../common/types/jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  public constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET', ''),
      ignoreExpiration: false,
      issuer: config.get<string>('JWT_ISSUER', 'swifteats'),
      audience: config.get<string>('JWT_AUDIENCE', 'swifteats-api'),
    });
  }

  public validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
