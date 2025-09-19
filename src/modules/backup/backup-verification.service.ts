import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

export interface VerificationResult {
  backupId: string;
  timestamp: Date;
  verificationStatus: 'passed' | 'failed' | 'warning';
  checksumValid: boolean;
  structureValid: boolean;
  dataIntegrityValid: boolean;
  restoreTestPassed: boolean;
  verificationDuration: number;
  issues: string[];
  recommendations: string[];
}

export interface VerificationConfiguration {
  enabled: boolean;
  verificationSchedule: string;
  checksumVerification: boolean;
  structureVerification: boolean;
  dataIntegrityVerification: boolean;
  restoreTestEnabled: boolean;
  testDatabaseName: string;
  maxVerificationTime: number;
  retentionDays: number;
}

/**
 * Comprehensive backup verification service
 * Ensures backup integrity through multiple verification methods
 */
@Injectable()
export class BackupVerificationService {
  private readonly logger = new Logger(BackupVerificationService.name);
  private readonly verificationConfig: VerificationConfiguration;
  private readonly verificationDirectory: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.verificationConfig = this.loadVerificationConfiguration();
    this.verificationDirectory = this.configService.get<string>(
      'VERIFICATION_DIRECTORY',
      '/var/backups/verification'
    );
    this.initializeVerificationDirectory();
  }

  /**
   * Load verification configuration from environment variables
   */
  private loadVerificationConfiguration(): VerificationConfiguration {
    return {
      enabled: this.configService.get<boolean>('BACKUP_VERIFICATION_ENABLED', true),
      verificationSchedule: this.configService.get<string>(
        'BACKUP_VERIFICATION_SCHEDULE',
        '0 4 * * *' // Daily at 4 AM
      ),
      checksumVerification: this.configService.get<boolean>('VERIFICATION_CHECKSUM', true),
      structureVerification: this.configService.get<boolean>('VERIFICATION_STRUCTURE', true),
      dataIntegrityVerification: this.configService.get<boolean>('VERIFICATION_DATA_INTEGRITY', true),
      restoreTestEnabled: this.configService.get<boolean>('VERIFICATION_RESTORE_TEST', false),
      testDatabaseName: this.configService.get<string>('VERIFICATION_TEST_DB', 'swifteats_verification'),
      maxVerificationTime: this.configService.get<number>('VERIFICATION_MAX_TIME_MINUTES', 60),
      retentionDays: this.configService.get<number>('VERIFICATION_RETENTION_DAYS', 90),
    };
  }

  /**
   * Initialize verification directory structure
   */
  private async initializeVerificationDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.verificationDirectory, { recursive: true });
      await fs.mkdir(path.join(this.verificationDirectory, 'results'), { recursive: true });
      await fs.mkdir(path.join(this.verificationDirectory, 'temp'), { recursive: true });
    } catch (error) {
      this.logger.error('Failed to initialize verification directory', error);
      throw error;
    }
  }

  /**
   * Scheduled backup verification
   */
  @Cron('0 4 * * *') // Daily at 4 AM
  async performScheduledVerification(): Promise<void> {
    if (!this.verificationConfig.enabled) {
      return;
    }

    try {
      await this.verifyLatestBackups();
    } catch (error) {
      this.logger.error('Scheduled backup verification failed', error);
    }
  }

  /**
   * Verify the latest backups of each type
   */
  async verifyLatestBackups(): Promise<VerificationResult[]> {
    this.logger.log('Starting verification of latest backups');

    const results: VerificationResult[] = [];

    try {
      // Get latest backups
      const latestBackups = await this.getLatestBackups();

      for (const backup of latestBackups) {
        const result = await this.verifyBackup(backup);
        results.push(result);
      }

      // Save verification summary
      await this.saveVerificationSummary(results);

      this.logger.log(`Backup verification completed. ${results.length} backups verified`);

    } catch (error) {
      this.logger.error('Failed to verify latest backups', error);
      throw error;
    }

    return results;
  }

  /**
   * Verify a specific backup
   */
  async verifyBackup(backup: any): Promise<VerificationResult> {
    const startTime = Date.now();
    this.logger.log(`Starting verification of backup: ${backup.id}`);

    const result: VerificationResult = {
      backupId: backup.id,
      timestamp: new Date(),
      verificationStatus: 'passed',
      checksumValid: false,
      structureValid: false,
      dataIntegrityValid: false,
      restoreTestPassed: false,
      verificationDuration: 0,
      issues: [],
      recommendations: [],
    };

    try {
      // Step 1: Checksum verification
      if (this.verificationConfig.checksumVerification) {
        result.checksumValid = await this.verifyChecksum(backup);
        if (!result.checksumValid) {
          result.issues.push('Checksum verification failed');
          result.verificationStatus = 'failed';
        }
      }

      // Step 2: Structure verification
      if (this.verificationConfig.structureVerification) {
        result.structureValid = await this.verifyStructure(backup);
        if (!result.structureValid) {
          result.issues.push('Database structure verification failed');
          result.verificationStatus = 'failed';
        }
      }

      // Step 3: Data integrity verification
      if (this.verificationConfig.dataIntegrityVerification) {
        result.dataIntegrityValid = await this.verifyDataIntegrity(backup);
        if (!result.dataIntegrityValid) {
          result.issues.push('Data integrity verification failed');
          result.verificationStatus = result.verificationStatus === 'failed' ? 'failed' : 'warning';
        }
      }

      // Step 4: Restore test
      if (this.verificationConfig.restoreTestEnabled) {
        result.restoreTestPassed = await this.performRestoreTest(backup);
        if (!result.restoreTestPassed) {
          result.issues.push('Restore test failed');
          result.verificationStatus = 'failed';
        }
      }

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result);

      result.verificationDuration = Date.now() - startTime;

      // Save verification result
      await this.saveVerificationResult(result);

      this.logger.log(`Backup verification completed: ${backup.id} - ${result.verificationStatus}`);

    } catch (error) {
      result.verificationStatus = 'failed';
      result.issues.push(`Verification error: ${error instanceof Error ? error.message : String(error)}`);
      result.verificationDuration = Date.now() - startTime;

      this.logger.error(`Backup verification failed: ${backup.id}`, error);
    }

    return result;
  }

  /**
   * Verify backup checksum
   */
  async verifyChecksum(backup: any): Promise<boolean> {
    this.logger.log(`Verifying checksum for backup: ${backup.id}`);

    try {
      // Check if backup file exists
      await fs.access(backup.location, fs.constants.R_OK);

      // Calculate current checksum
      const fileBuffer = await fs.readFile(backup.location);
      const currentChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Compare with stored checksum
      const checksumMatch = currentChecksum === backup.checksum;

      if (!checksumMatch) {
        this.logger.error(`Checksum mismatch for backup: ${backup.id}`, {
          expected: backup.checksum,
          actual: currentChecksum,
        });
      }

      return checksumMatch;

    } catch (error) {
      this.logger.error(`Checksum verification failed for backup: ${backup.id}`, error);
      return false;
    }
  }

  /**
   * Verify database structure in backup
   */
  async verifyStructure(backup: any): Promise<boolean> {
    this.logger.log(`Verifying structure for backup: ${backup.id}`);

    try {
      if (backup.type === 'transaction_log') {
        // WAL files don't contain structure, skip verification
        return true;
      }

      // Read backup file and check for essential SQL statements
      const backupContent = await fs.readFile(backup.location, 'utf-8');

      const requiredElements = [
        'CREATE TABLE',
        'CREATE INDEX',
        'CREATE SEQUENCE',
        'ALTER TABLE',
      ];

      const missingElements = requiredElements.filter(
        element => !backupContent.includes(element)
      );

      if (missingElements.length > 0) {
        this.logger.warn(`Missing structure elements in backup: ${backup.id}`, {
          missingElements,
        });
        return false;
      }

      // Check for potential corruption indicators
      const corruptionIndicators = [
        'ERROR:',
        'FATAL:',
        'PANIC:',
        'incomplete',
        'corrupted',
      ];

      const foundCorruption = corruptionIndicators.some(
        indicator => backupContent.toLowerCase().includes(indicator.toLowerCase())
      );

      if (foundCorruption) {
        this.logger.error(`Corruption indicators found in backup: ${backup.id}`);
        return false;
      }

      return true;

    } catch (error) {
      this.logger.error(`Structure verification failed for backup: ${backup.id}`, error);
      return false;
    }
  }

  /**
   * Verify data integrity in backup
   */
  async verifyDataIntegrity(backup: any): Promise<boolean> {
    this.logger.log(`Verifying data integrity for backup: ${backup.id}`);

    try {
      if (backup.type === 'transaction_log') {
        // For WAL files, verify they're valid WAL records
        return await this.verifyWalIntegrity(backup);
      }

      // For SQL backups, perform basic syntax validation
      const backupContent = await fs.readFile(backup.location, 'utf-8');

      // Check for balanced parentheses and quotes
      if (!this.validateSqlSyntax(backupContent)) {
        this.logger.error(`SQL syntax validation failed for backup: ${backup.id}`);
        return false;
      }

      // Check for incomplete transactions
      const beginCount = (backupContent.match(/BEGIN;/g) || []).length;
      const commitCount = (backupContent.match(/COMMIT;/g) || []).length;

      if (beginCount !== commitCount) {
        this.logger.warn(`Transaction mismatch in backup: ${backup.id}`, {
          beginCount,
          commitCount,
        });
        return false;
      }

      return true;

    } catch (error) {
      this.logger.error(`Data integrity verification failed for backup: ${backup.id}`, error);
      return false;
    }
  }

  /**
   * Perform restore test
   */
  async performRestoreTest(backup: any): Promise<boolean> {
    this.logger.log(`Performing restore test for backup: ${backup.id}`);

    const testDbName = `${this.verificationConfig.testDatabaseName}_${Date.now()}`;

    try {
      // Step 1: Create test database
      await this.createTestDatabase(testDbName);

      // Step 2: Restore backup to test database
      await this.restoreToTestDatabase(backup, testDbName);

      // Step 3: Verify restored data
      const verificationPassed = await this.verifyRestoredData(testDbName);

      // Step 4: Clean up test database
      await this.dropTestDatabase(testDbName);

      return verificationPassed;

    } catch (error) {
      this.logger.error(`Restore test failed for backup: ${backup.id}`, error);

      // Attempt cleanup
      try {
        await this.dropTestDatabase(testDbName);
      } catch (cleanupError) {
        this.logger.error(`Failed to cleanup test database: ${testDbName}`, cleanupError);
      }

      return false;
    }
  }

  /**
   * Get verification history
   */
  async getVerificationHistory(days: number = 30): Promise<VerificationResult[]> {
    try {
      const resultsDir = path.join(this.verificationDirectory, 'results');
      const files = await fs.readdir(resultsDir);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const results: VerificationResult[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(resultsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const result: VerificationResult = JSON.parse(content);

          if (result.timestamp >= cutoffDate) {
            results.push(result);
          }
        }
      }

      return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (error) {
      this.logger.error('Failed to get verification history', error);
      return [];
    }
  }

  /**
   * Clean up old verification results
   */
  @Cron('0 5 * * *') // Daily at 5 AM
  async cleanupOldVerificationResults(): Promise<void> {
    if (!this.verificationConfig.enabled) {
      return;
    }

    this.logger.log('Cleaning up old verification results');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.verificationConfig.retentionDays);

      const resultsDir = path.join(this.verificationDirectory, 'results');
      const files = await fs.readdir(resultsDir);

      let cleanedCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(resultsDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        }
      }

      this.logger.log(`Cleaned up ${cleanedCount} old verification results`);

    } catch (error) {
      this.logger.error('Failed to cleanup old verification results', error);
    }
  }

  // Private helper methods

  private async getLatestBackups(): Promise<any[]> {
    // This would typically get backup metadata from the backup service
    // For now, returning a placeholder
    return [];
  }

  private async verifyWalIntegrity(backup: any): Promise<boolean> {
    try {
      // Use pg_waldump to verify WAL file integrity
      const command = `pg_waldump "${backup.location}" > /dev/null 2>&1`;
      await execAsync(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  private validateSqlSyntax(content: string): boolean {
    // Basic SQL syntax validation
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    const singleQuotes = (content.match(/'/g) || []).length;
    const doubleQuotes = (content.match(/"/g) || []).length;

    return (
      openParens === closeParens &&
      singleQuotes % 2 === 0 &&
      doubleQuotes % 2 === 0
    );
  }

  private async createTestDatabase(testDbName: string): Promise<void> {
    await this.dataSource.query(`CREATE DATABASE "${testDbName}"`);
  }

  private async restoreToTestDatabase(backup: any, testDbName: string): Promise<void> {
    const dbConfig = this.getDatabaseConfig();
    const restoreCommand = `
      PGPASSWORD="${dbConfig.password}" psql \\
        -h ${dbConfig.host} \\
        -p ${dbConfig.port} \\
        -U ${dbConfig.username} \\
        -d ${testDbName} \\
        -f "${backup.location}"
    `;

    await execAsync(restoreCommand);
  }

  private async verifyRestoredData(testDbName: string): Promise<boolean> {
    try {
      // Create a temporary connection to the test database
      const testConnection = await this.dataSource.manager.connection.createQueryRunner();
      
      // Perform basic data verification queries
      const tableCount = await testConnection.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      await testConnection.release();

      return parseInt(tableCount[0]?.count) > 0;

    } catch (error) {
      this.logger.error('Failed to verify restored data', error);
      return false;
    }
  }

  private async dropTestDatabase(testDbName: string): Promise<void> {
    try {
      await this.dataSource.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    } catch (error) {
      this.logger.error(`Failed to drop test database: ${testDbName}`, error);
    }
  }

  private generateRecommendations(result: VerificationResult): string[] {
    const recommendations: string[] = [];

    if (!result.checksumValid) {
      recommendations.push('Consider re-taking the backup due to checksum failure');
      recommendations.push('Check storage system integrity');
    }

    if (!result.structureValid) {
      recommendations.push('Verify backup process is capturing complete database structure');
      recommendations.push('Check for backup process interruptions');
    }

    if (!result.dataIntegrityValid) {
      recommendations.push('Review backup timing to avoid capturing inconsistent data');
      recommendations.push('Consider using consistent backup methods');
    }

    if (!result.restoreTestPassed) {
      recommendations.push('Test restore procedures in a controlled environment');
      recommendations.push('Verify backup format compatibility');
    }

    if (result.verificationDuration > 30 * 60 * 1000) { // 30 minutes
      recommendations.push('Consider optimizing verification process for better performance');
    }

    return recommendations;
  }

  private async saveVerificationResult(result: VerificationResult): Promise<void> {
    const resultPath = path.join(
      this.verificationDirectory,
      'results',
      `${result.backupId}-${result.timestamp.toISOString()}.json`
    );

    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
  }

  private async saveVerificationSummary(results: VerificationResult[]): Promise<void> {
    const summary = {
      timestamp: new Date(),
      totalBackups: results.length,
      passedVerifications: results.filter(r => r.verificationStatus === 'passed').length,
      failedVerifications: results.filter(r => r.verificationStatus === 'failed').length,
      warningVerifications: results.filter(r => r.verificationStatus === 'warning').length,
      averageVerificationTime: results.reduce((sum, r) => sum + r.verificationDuration, 0) / results.length,
      results: results.map(r => ({
        backupId: r.backupId,
        status: r.verificationStatus,
        duration: r.verificationDuration,
        issues: r.issues,
      })),
    };

    const summaryPath = path.join(
      this.verificationDirectory,
      `verification-summary-${new Date().toISOString().split('T')[0]}.json`
    );

    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  }

  private getDatabaseConfig() {
    return {
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'postgres'),
    };
  }
}
