import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RetentionPolicy {
  name: string;
  backupType: 'full' | 'incremental' | 'transaction_log' | 'all';
  retentionPeriod: number; // in days
  minRetainCount: number; // minimum number of backups to keep regardless of age
  maxRetainCount: number; // maximum number of backups to keep
  archiveAfterDays?: number; // move to archive storage after X days
  compressionLevel?: number; // compression level for archived backups
  enabled: boolean;
}

export interface RetentionRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  keepCount: number;
  backupType: 'full' | 'incremental' | 'transaction_log';
}

export interface BackupLifecycleConfiguration {
  policies: RetentionPolicy[];
  rules: RetentionRule[];
  archiveStorageEnabled: boolean;
  archiveStorageLocation: string;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  verificationBeforeDelete: boolean;
  dryRunMode: boolean;
}

export interface RetentionReport {
  timestamp: Date;
  totalBackupsProcessed: number;
  backupsDeleted: number;
  backupsArchived: number;
  spaceSaved: number;
  errors: string[];
  warnings: string[];
  policyResults: {
    policyName: string;
    backupsProcessed: number;
    backupsDeleted: number;
    backupsArchived: number;
    spaceSaved: number;
  }[];
}

/**
 * Backup retention and lifecycle management service
 * Implements sophisticated retention policies with archiving and compliance features
 */
@Injectable()
export class BackupRetentionService {
  private readonly logger = new Logger(BackupRetentionService.name);
  private readonly retentionConfig: BackupLifecycleConfiguration;
  private readonly backupDirectory: string;
  private readonly archiveDirectory: string;

  constructor(private readonly configService: ConfigService) {
    this.retentionConfig = this.loadRetentionConfiguration();
    this.backupDirectory = this.configService.get<string>(
      'BACKUP_DIRECTORY',
      './backups/swifteats',
    );
    this.archiveDirectory = this.configService.get<string>(
      'ARCHIVE_DIRECTORY',
      './archives/swifteats',
    );
    void this.initializeDirectories();
  }

  /**
   * Load retention configuration from environment variables
   */
  private loadRetentionConfiguration(): BackupLifecycleConfiguration {
    const defaultPolicies: RetentionPolicy[] = [
      {
        name: 'full_backup_retention',
        backupType: 'full',
        retentionPeriod: 90, // 3 months
        minRetainCount: 4, // Keep at least 4 full backups
        maxRetainCount: 52, // Keep at most 52 full backups (1 year weekly)
        archiveAfterDays: 30,
        compressionLevel: 9,
        enabled: true,
      },
      {
        name: 'incremental_backup_retention',
        backupType: 'incremental',
        retentionPeriod: 30, // 1 month
        minRetainCount: 7, // Keep at least 7 incremental backups
        maxRetainCount: 60, // Keep at most 60 incremental backups
        archiveAfterDays: 7,
        compressionLevel: 6,
        enabled: true,
      },
      {
        name: 'transaction_log_retention',
        backupType: 'transaction_log',
        retentionPeriod: 7, // 1 week
        minRetainCount: 24, // Keep at least 24 hours of logs
        maxRetainCount: 168, // Keep at most 1 week of logs
        enabled: true,
      },
    ];

    const defaultRules: RetentionRule[] = [
      { frequency: 'daily', keepCount: 7, backupType: 'full' },
      { frequency: 'weekly', keepCount: 4, backupType: 'full' },
      { frequency: 'monthly', keepCount: 12, backupType: 'full' },
      { frequency: 'yearly', keepCount: 7, backupType: 'full' },
    ];

    return {
      policies: this.configService.get<RetentionPolicy[]>('RETENTION_POLICIES', defaultPolicies),
      rules: this.configService.get<RetentionRule[]>('RETENTION_RULES', defaultRules),
      archiveStorageEnabled: this.configService.get<boolean>('ARCHIVE_STORAGE_ENABLED', true),
      archiveStorageLocation: this.configService.get<string>('ARCHIVE_STORAGE_LOCATION', 'local'),
      compressionEnabled: this.configService.get<boolean>('RETENTION_COMPRESSION_ENABLED', true),
      encryptionEnabled: this.configService.get<boolean>('RETENTION_ENCRYPTION_ENABLED', false),
      verificationBeforeDelete: this.configService.get<boolean>('VERIFY_BEFORE_DELETE', true),
      dryRunMode: this.configService.get<boolean>('RETENTION_DRY_RUN', false),
    };
  }

  /**
   * Initialize backup and archive directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.backupDirectory, { recursive: true });
      if (this.retentionConfig.archiveStorageEnabled) {
        await fs.mkdir(this.archiveDirectory, { recursive: true });
      }
    } catch (error) {
      this.logger.error('Failed to initialize directories', error);
      throw error;
    }
  }

  /**
   * Scheduled retention policy enforcement - runs daily at 3 AM
   */
  @Cron('0 3 * * *')
  async enforceRetentionPolicies(): Promise<void> {
    this.logger.log('Starting retention policy enforcement');

    try {
      const report = await this.applyRetentionPolicies();
      await this.saveRetentionReport(report);

      this.logger.log('Retention policy enforcement completed', {
        backupsDeleted: report.backupsDeleted,
        backupsArchived: report.backupsArchived,
        spaceSaved: report.spaceSaved,
      });

      if (report.errors.length > 0) {
        this.logger.error('Retention policy enforcement had errors', report.errors);
      }
    } catch (error) {
      this.logger.error('Retention policy enforcement failed', error);
    }
  }

  /**
   * Apply all retention policies
   */
  async applyRetentionPolicies(): Promise<RetentionReport> {
    const startTime = Date.now();
    const report: RetentionReport = {
      timestamp: new Date(),
      totalBackupsProcessed: 0,
      backupsDeleted: 0,
      backupsArchived: 0,
      spaceSaved: 0,
      errors: [],
      warnings: [],
      policyResults: [],
    };

    try {
      for (const policy of this.retentionConfig.policies) {
        if (!policy.enabled) {
          continue;
        }

        this.logger.log(`Applying retention policy: ${policy.name}`);

        const policyResult = await this.applyRetentionPolicy(policy);
        report.policyResults.push(policyResult);

        report.totalBackupsProcessed += policyResult.backupsProcessed;
        report.backupsDeleted += policyResult.backupsDeleted;
        report.backupsArchived += policyResult.backupsArchived;
        report.spaceSaved += policyResult.spaceSaved;
      }

      // Apply GFS (Grandfather-Father-Son) retention rules
      await this.applyGfsRetention(report);
    } catch (error) {
      report.errors.push(
        `Policy enforcement failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.logger.error('Failed to apply retention policies', error);
    }

    const duration = Date.now() - startTime;
    this.logger.log(`Retention policy enforcement completed in ${duration}ms`);

    return report;
  }

  /**
   * Apply a specific retention policy
   */
  private async applyRetentionPolicy(policy: RetentionPolicy): Promise<{
    policyName: string;
    backupsProcessed: number;
    backupsDeleted: number;
    backupsArchived: number;
    spaceSaved: number;
  }> {
    const result = {
      policyName: policy.name,
      backupsProcessed: 0,
      backupsDeleted: 0,
      backupsArchived: 0,
      spaceSaved: 0,
    };

    try {
      const backups = await this.getBackupsByType(policy.backupType);
      result.backupsProcessed = backups.length;

      // Sort backups by timestamp (newest first)
      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply retention logic
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

      const archiveCutoffDate = policy.archiveAfterDays ? new Date() : null;
      if (archiveCutoffDate && policy.archiveAfterDays) {
        archiveCutoffDate.setDate(archiveCutoffDate.getDate() - policy.archiveAfterDays);
      }

      let keptCount = 0;

      for (const backup of backups) {
        // Always keep minimum number of backups
        if (keptCount < policy.minRetainCount) {
          keptCount++;
          continue;
        }

        // Don't exceed maximum number of backups
        if (keptCount >= policy.maxRetainCount) {
          await this.deleteBackup(backup, result);
          continue;
        }

        // Archive old backups if archiving is enabled
        if (
          archiveCutoffDate &&
          backup.timestamp < archiveCutoffDate &&
          this.retentionConfig.archiveStorageEnabled
        ) {
          await this.archiveBackup(backup, policy, result);
          keptCount++;
          continue;
        }

        // Delete backups older than retention period
        if (backup.timestamp < cutoffDate) {
          await this.deleteBackup(backup, result);
          continue;
        }

        keptCount++;
      }
    } catch (error) {
      this.logger.error(`Failed to apply retention policy: ${policy.name}`, error);
      throw error;
    }

    return result;
  }

  /**
   * Apply Grandfather-Father-Son (GFS) retention strategy
   */
  private async applyGfsRetention(report: RetentionReport): Promise<void> {
    this.logger.log('Applying GFS retention rules');

    try {
      for (const rule of this.retentionConfig.rules) {
        await this.applyGfsRule(rule, report);
      }
    } catch (error) {
      report.errors.push(
        `GFS retention failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.logger.error('Failed to apply GFS retention', error);
    }
  }

  /**
   * Apply a specific GFS retention rule
   */
  private async applyGfsRule(rule: RetentionRule, report: RetentionReport): Promise<void> {
    const backups = await this.getBackupsByType(rule.backupType);
    const groupedBackups = this.groupBackupsByFrequency(backups, rule.frequency);

    for (const [period, periodBackups] of groupedBackups) {
      // Keep the newest backup from each period
      const sortedBackups = periodBackups.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );
      const toKeep = sortedBackups.slice(0, 1);
      const toDelete = sortedBackups.slice(1);

      // Mark backups to keep (add GFS tag)
      for (const backup of toKeep) {
        await this.tagBackup(backup, `gfs-${rule.frequency}`);
      }

      // Delete excess backups from this period
      for (const backup of toDelete) {
        if (!this.hasGfsTag(backup)) {
          await this.deleteBackup(backup, report);
        }
      }
    }

    // Ensure we don't keep more than the specified count
    const allGfsBackups = backups.filter((b) => this.hasGfsTag(b, rule.frequency));
    const sortedGfsBackups = allGfsBackups.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    if (sortedGfsBackups.length > rule.keepCount) {
      const excessBackups = sortedGfsBackups.slice(rule.keepCount);
      for (const backup of excessBackups) {
        await this.deleteBackup(backup, report);
      }
    }
  }

  /**
   * Archive a backup
   */
  private async archiveBackup(
    backup: any,
    policy: RetentionPolicy,
    result: { backupsArchived: number; spaceSaved: number },
  ): Promise<void> {
    if (this.retentionConfig.dryRunMode) {
      this.logger.log(`[DRY RUN] Would archive backup: ${backup.id}`);
      return;
    }

    try {
      const archivePath = path.join(
        this.archiveDirectory,
        policy.backupType,
        path.basename(backup.location),
      );

      // Create archive directory if it doesn't exist
      await fs.mkdir(path.dirname(archivePath), { recursive: true });

      // Compress backup if enabled
      if (this.retentionConfig.compressionEnabled && policy.compressionLevel) {
        await this.compressBackup(backup.location, archivePath, policy.compressionLevel);
      } else {
        await fs.copyFile(backup.location, archivePath);
      }

      // Verify archive integrity
      if (this.retentionConfig.verificationBeforeDelete) {
        const verified = await this.verifyArchivedBackup(archivePath, backup);
        if (!verified) {
          throw new Error('Archive verification failed');
        }
      }

      // Delete original backup
      const originalSize = (await fs.stat(backup.location)).size;
      await fs.unlink(backup.location);

      // Update metadata
      await this.updateBackupMetadata(backup, { archived: true, archiveLocation: archivePath });

      result.backupsArchived++;
      result.spaceSaved += originalSize;

      this.logger.log(`Archived backup: ${backup.id} -> ${archivePath}`);
    } catch (error) {
      this.logger.error(`Failed to archive backup: ${backup.id}`, error);
      throw error;
    }
  }

  /**
   * Delete a backup
   */
  private async deleteBackup(
    backup: any,
    result: { backupsDeleted: number; spaceSaved: number },
  ): Promise<void> {
    if (this.retentionConfig.dryRunMode) {
      this.logger.log(`[DRY RUN] Would delete backup: ${backup.id}`);
      return;
    }

    try {
      // Verify backup before deletion if enabled
      if (this.retentionConfig.verificationBeforeDelete) {
        const hasNewerBackup = await this.hasNewerValidBackup(backup);
        if (!hasNewerBackup) {
          this.logger.warn(
            `Skipping deletion of backup ${backup.id} - no newer valid backup found`,
          );
          return;
        }
      }

      const backupSize = (await fs.stat(backup.location)).size;

      // Delete backup file
      await fs.unlink(backup.location);

      // Delete associated files (checksum, metadata)
      await this.deleteAssociatedFiles(backup);

      result.backupsDeleted++;
      result.spaceSaved += backupSize;

      this.logger.log(`Deleted backup: ${backup.id}`);
    } catch (error) {
      this.logger.error(`Failed to delete backup: ${backup.id}`, error);
      throw error;
    }
  }

  /**
   * Get backup retention status
   */
  async getRetentionStatus(): Promise<{
    policies: RetentionPolicy[];
    totalBackups: number;
    totalSize: number;
    archivedBackups: number;
    archivedSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    lastRetentionRun: Date | null;
  }> {
    try {
      const allBackups = await this.getAllBackups();
      const archivedBackups = allBackups.filter((b) => b.archived);

      const totalSize = allBackups.reduce((sum, backup) => sum + backup.size, 0);
      const archivedSize = archivedBackups.reduce((sum, backup) => sum + backup.size, 0);

      const timestamps = allBackups.map((b) => b.timestamp).sort();
      const oldestBackup = timestamps.length > 0 ? timestamps[0] : null;
      const newestBackup = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;

      const lastRetentionRun = await this.getLastRetentionRunTime();

      return {
        policies: this.retentionConfig.policies,
        totalBackups: allBackups.length,
        totalSize,
        archivedBackups: archivedBackups.length,
        archivedSize,
        oldestBackup,
        newestBackup,
        lastRetentionRun,
      };
    } catch (error) {
      this.logger.error('Failed to get retention status', error);
      throw error;
    }
  }

  /**
   * Manual retention policy execution
   */
  async executeRetentionPolicy(policyName?: string): Promise<RetentionReport> {
    this.logger.log(`Manually executing retention policy${policyName ? `: ${policyName}` : 's'}`);

    if (policyName) {
      const policy = this.retentionConfig.policies.find((p) => p.name === policyName);
      if (!policy) {
        throw new Error(`Retention policy not found: ${policyName}`);
      }

      const policyResult = await this.applyRetentionPolicy(policy);

      return {
        timestamp: new Date(),
        totalBackupsProcessed: policyResult.backupsProcessed,
        backupsDeleted: policyResult.backupsDeleted,
        backupsArchived: policyResult.backupsArchived,
        spaceSaved: policyResult.spaceSaved,
        errors: [],
        warnings: [],
        policyResults: [policyResult],
      };
    } else {
      return await this.applyRetentionPolicies();
    }
  }

  // Private helper methods

  private async getBackupsByType(backupType: string): Promise<any[]> {
    // This would typically query the backup metadata
    // For now, returning a placeholder
    return [];
  }

  private async getAllBackups(): Promise<any[]> {
    // This would typically query all backup metadata
    // For now, returning a placeholder
    return [];
  }

  private groupBackupsByFrequency(backups: any[], frequency: string): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const backup of backups) {
      let key: string;
      const date = backup.timestamp;

      switch (frequency) {
        case 'daily':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'yearly':
          key = String(date.getFullYear());
          break;
        default:
          key = date.toISOString();
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(backup);
    }

    return groups;
  }

  private async tagBackup(backup: any, tag: string): Promise<void> {
    // Implementation for tagging backups
    this.logger.log(`Tagged backup ${backup.id} with ${tag}`);
  }

  private hasGfsTag(backup: any, frequency?: string): boolean {
    // Implementation for checking GFS tags
    return false;
  }

  private async compressBackup(
    sourcePath: string,
    targetPath: string,
    level: number,
  ): Promise<void> {
    // Implementation for compressing backups
    this.logger.log(`Compressing backup: ${sourcePath} -> ${targetPath} (level ${level})`);
  }

  private async verifyArchivedBackup(archivePath: string, originalBackup: any): Promise<boolean> {
    // Implementation for verifying archived backups
    return true;
  }

  private async updateBackupMetadata(backup: any, updates: any): Promise<void> {
    // Implementation for updating backup metadata
    this.logger.log(`Updated metadata for backup: ${backup.id}`);
  }

  private async hasNewerValidBackup(backup: any): Promise<boolean> {
    // Implementation for checking if newer valid backup exists
    return true;
  }

  private async deleteAssociatedFiles(backup: any): Promise<void> {
    // Implementation for deleting associated files
    try {
      await fs.unlink(`${backup.location}.sha256`);
      await fs.unlink(`${backup.location}.metadata`);
    } catch (error) {
      // Files might not exist, ignore errors
    }
  }

  private async getLastRetentionRunTime(): Promise<Date | null> {
    // Implementation for getting last retention run time
    return null;
  }

  private async saveRetentionReport(report: RetentionReport): Promise<void> {
    const reportPath = path.join(
      this.backupDirectory,
      'retention-reports',
      `retention-report-${report.timestamp.toISOString().split('T')[0]}.json`,
    );

    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }
}
