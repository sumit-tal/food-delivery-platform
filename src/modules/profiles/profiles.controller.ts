import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CryptoService } from '../../common/security/crypto.service';

interface ProfileView {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly fullName: string;
  readonly phone?: string;
  readonly address?: string;
}

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  public constructor(
    private readonly users: UsersService,
    private readonly crypto: CryptoService,
  ) {}

  @Get('me')
  public getMe(@Request() req: { user: { sub: string } }): ProfileView {
    const u = this.users.getById(req.user.sub);
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.fullName,
      phone: u.phoneEncrypted ? this.crypto.decrypt(u.phoneEncrypted) : undefined,
      address: u.addressEncrypted ? this.crypto.decrypt(u.addressEncrypted) : undefined,
    };
  }

  @Patch('me')
  public updateMe(
    @Request() req: { user: { sub: string } },
    @Body() dto: UpdateProfileDto,
  ): ProfileView {
    const updated = this.users.updateProfile(req.user.sub, dto, (v: string) =>
      this.crypto.encrypt(v),
    );
    const u = this.users.getById(updated.id);
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.fullName,
      phone: u.phoneEncrypted ? this.crypto.decrypt(u.phoneEncrypted) : undefined,
      address: u.addressEncrypted ? this.crypto.decrypt(u.addressEncrypted) : undefined,
    };
  }
}
