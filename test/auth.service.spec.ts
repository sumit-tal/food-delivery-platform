import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../src/modules/auth/auth.service';
import type { RegisterDto } from '../src/modules/auth/dto/register.dto';
import { UserRole } from '../src/common/constants/roles.enum';
import { UsersService } from '../src/modules/users/users.service';
import { CryptoService } from '../src/common/security/crypto.service';

describe('When AuthService is used', () => {
  let service: AuthService;
  const usersMock = {
    create: jest.fn((dto: RegisterDto) => Promise.resolve({ id: 'u1', email: dto.email })),
    getPublicById: jest.fn((id: string) => ({
      id,
      email: 'user@example.com',
      role: UserRole.CUSTOMER,
      fullName: 'User',
    })),
  };

  const configMock = {
    get: <T = string>(key: string, defaultValue?: T): T => {
      switch (key) {
        case 'JWT_SECRET':
          return 'test-secret' as unknown as T;
        case 'JWT_EXPIRES_IN':
          return '15m' as unknown as T;
        case 'JWT_ISSUER':
          return 'swifteats' as unknown as T;
        case 'JWT_AUDIENCE':
          return 'swifteats-api' as unknown as T;
        case 'ENCRYPTION_KEY':
          return 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' as unknown as T; // 32 zero bytes in base64
        default:
          return (defaultValue as T) ?? ('' as unknown as T);
      }
    },
  } as unknown as ConfigService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '15m' } })],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: ConfigService, useValue: configMock },
        { provide: CryptoService, useFactory: (): CryptoService => new CryptoService(configMock) },
      ],
    }).compile();

    service = moduleRef.get<AuthService>(AuthService);
  });

  it('Then register should return user id and email', async () => {
    const dto: RegisterDto = {
      email: 'new@example.com',
      password: 'password123',
      role: UserRole.CUSTOMER,
      fullName: 'New User',
    } as RegisterDto;
    const res = await service.register(dto);
    expect(res.id).toBe('u1');
    expect(res.email).toBe('new@example.com');
  });

  it('Then login should return a JWT access token', async () => {
    const res = await service.login('u1');
    expect(typeof res.accessToken).toBe('string');
    expect(res.accessToken.length).toBeGreaterThan(10);
  });
});
