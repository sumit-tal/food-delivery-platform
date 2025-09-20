import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard';

@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Post('register')
  public register(@Body() dto: RegisterDto): Promise<{ id: string; email: string }>
  {
    return this.authService.register(dto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  public login(@Request() req: { user: { id: string } }): Promise<{ accessToken: string }>
  {
    return this.authService.login(req.user.id);
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  public googleAuth(): void
  {
    return;
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  public googleCallback(@Request() req: { user: { id: string } }): Promise<{ accessToken: string }>
  {
    return this.authService.login(req.user.id);
  }
}
