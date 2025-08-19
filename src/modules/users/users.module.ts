import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PasswordService } from '../../common/security/password.service';

@Module({
  providers: [UsersService, PasswordService],
  exports: [UsersService]
})
export class UsersModule {}
