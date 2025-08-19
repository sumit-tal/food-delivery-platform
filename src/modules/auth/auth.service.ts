import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '../../common/types/jwt-payload';
import { CryptoService } from '../../common/security/crypto.service';

@Injectable()
export class AuthService {
  public constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService
  ) {}

  public async register(dto: RegisterDto): Promise<{ id: string; email: string }>
  {
    const user = await this.usersService.create(dto, (v: string) => this.crypto.encrypt(v));
    return { id: user.id, email: user.email };
  }

  public async login(userId: string): Promise<{ accessToken: string }>
  {
    const user = this.usersService.getPublicById(userId);
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const expiresIn: string = this.config.get<string>('JWT_EXPIRES_IN', '15m');
    const token: string = await this.jwtService.signAsync(payload, {
      expiresIn,
      issuer: this.config.get<string>('JWT_ISSUER', 'swifteats'),
      audience: this.config.get<string>('JWT_AUDIENCE', 'swifteats-api')
    });
    return { accessToken: token };
  }
}
