import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UsersService } from '../../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  public constructor(private readonly usersService: UsersService) {
    super({ usernameField: 'email' });
  }

  public async validate(email: string, password: string): Promise<{ id: string }> {
    const user = await this.usersService.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { id: user.id };
  }
}
