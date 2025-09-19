import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { DisasterRecoveryService } from './disaster-recovery.service';
import { ReplicationService } from './replication.service';
import { BackupVerificationService } from './backup-verification.service';
import { BackupRetentionService } from './backup-retention.service';

/**
 * Module for comprehensive backup and disaster recovery functionality
 * Provides automated backups, replication, and disaster recovery capabilities
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule,
  ],
  providers: [
    BackupService,
    DisasterRecoveryService,
    ReplicationService,
    BackupVerificationService,
    BackupRetentionService,
  ],
  controllers: [BackupController],
  exports: [
    BackupService,
    DisasterRecoveryService,
    ReplicationService,
    BackupVerificationService,
    BackupRetentionService,
  ],
})
export class BackupModule {}
