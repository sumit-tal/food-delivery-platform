import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { UsersModule } from '../users/users.module';
import { CryptoService } from '../../common/security/crypto.service';

@Module({
  imports: [UsersModule],
  controllers: [ProfilesController],
  providers: [CryptoService]
})
export class ProfilesModule {}
