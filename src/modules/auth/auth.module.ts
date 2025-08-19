import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CryptoService } from '../../common/security/crypto.service';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', ''),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') }
      })
    })
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy, GoogleStrategy, CryptoService],
  controllers: [AuthController]
})
export class AuthModule {}
