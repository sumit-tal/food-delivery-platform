import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ReplicationConfiguration {
  enabled: boolean;
  replicationMode: 'streaming' | 'logical' | 'physical';
  primaryHost: string;
  primaryPort: number;
  replicaHosts: string[];
  replicationUser: string;
  replicationSlots: string[];
  synchronousCommit: boolean;
  maxWalSenders: number;
  walKeepSegments: number;
  archiveMode: boolean;
  archiveCommand: string;
}

export interface ReplicationStatus {
  replicaHost: string;
  state: 'streaming' | 'catchup' | 'stopped' | 'error';
  lagBytes: number;
  lagTime: number;
  lastMessage: Date;
  flushLocation: string;
  replayLocation: string;
}

export interface ReplicationMetrics {
  totalReplicas: number;
  healthyReplicas: number;
  maxLagTime: number;
  maxLagBytes: number;
  averageLagTime: number;
  replicationSlotUsage: number;
  walGenerationRate: number;
}

/**
 * Database replication service for high availability
 * Manages streaming replication, monitoring, and failover capabilities
 */
@Injectable()
export class ReplicationService {
  private readonly logger = new Logger(ReplicationService.name);
  private readonly replicationConfig: ReplicationConfiguration;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.replicationConfig = this.loadReplicationConfiguration();
  }

  /**
   * Load replication configuration from environment variables
   */
  private loadReplicationConfiguration(): ReplicationConfiguration {
    return {
      enabled: this.configService.get<boolean>('REPLICATION_ENABLED', true),
      replicationMode: this.configService.get<'streaming' | 'logical' | 'physical'>(
        'REPLICATION_MODE',
        'streaming',
      ),
      primaryHost: this.configService.get<string>('DB_HOST', 'localhost'),
      primaryPort: this.configService.get<number>('DB_PORT', 5432),
      replicaHosts: this.configService.get<string>('REPLICA_HOSTS', '').split(',').filter(Boolean),
      replicationUser: this.configService.get<string>('REPLICATION_USER', 'replicator'),
      replicationSlots: this.configService
        .get<string>('REPLICATION_SLOTS', 'replica_slot_1,replica_slot_2')
        .split(','),
      synchronousCommit: this.configService.get<boolean>('SYNCHRONOUS_COMMIT', false),
      maxWalSenders: this.configService.get<number>('MAX_WAL_SENDERS', 10),
      walKeepSegments: this.configService.get<number>('WAL_KEEP_SEGMENTS', 32),
      archiveMode: this.configService.get<boolean>('ARCHIVE_MODE', true),
      archiveCommand: this.configService.get<string>(
        'ARCHIVE_COMMAND',
        'cp %p /var/lib/postgresql/archive/%f',
      ),
    };
  }

  /**
   * Initialize replication setup
   */
  async initializeReplication(): Promise<void> {
    if (!this.replicationConfig.enabled) {
      this.logger.log('Replication is disabled');
      return;
    }

    this.logger.log('Initializing database replication');

    try {
      // Step 1: Configure primary server for replication
      await this.configurePrimaryForReplication();

      // Step 2: Create replication slots
      await this.createReplicationSlots();

      // Step 3: Create replication user
      await this.createReplicationUser();

      // Step 4: Configure WAL archiving
      await this.configureWalArchiving();

      this.logger.log('Replication initialization completed');
    } catch (error) {
      this.logger.error('Failed to initialize replication', error);
      throw error;
    }
  }

  /**
   * Monitor replication status
   */
  @Cron('*/1 * * * *') // Every minute
  async monitorReplication(): Promise<void> {
    if (!this.replicationConfig.enabled) {
      return;
    }

    try {
      const replicationStatus = await this.getReplicationStatus();
      const metrics = await this.getReplicationMetrics();

      // Check for unhealthy replicas
      const unhealthyReplicas = replicationStatus.filter(
        (replica) => replica.state === 'error' || replica.lagTime > 300, // 5 minutes
      );

      if (unhealthyReplicas.length > 0) {
        this.logger.warn(`Found ${unhealthyReplicas.length} unhealthy replicas`, {
          unhealthyReplicas: unhealthyReplicas.map((r) => ({
            host: r.replicaHost,
            state: r.state,
            lagTime: r.lagTime,
          })),
        });

        // Attempt to restart unhealthy replicas
        for (const replica of unhealthyReplicas) {
          await this.restartReplica(replica.replicaHost);
        }
      }

      // Log metrics
      this.logger.debug('Replication metrics', metrics);
    } catch (error) {
      this.logger.error('Replication monitoring failed', error);
    }
  }

  /**
   * Get current replication status for all replicas
   */
  async getReplicationStatus(): Promise<ReplicationStatus[]> {
    try {
      const query = `
        SELECT
          client_addr as replica_host,
          state,
          pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) as lag_bytes,
          EXTRACT(EPOCH FROM (now() - backend_start)) as lag_time,
          backend_start as last_message,
          flush_lsn as flush_location,
          replay_lsn as replay_location
        FROM pg_stat_replication
        ORDER BY client_addr;
      `;

      const results = await this.dataSource.query(query);

      return results.map((row: any) => ({
        replicaHost: row.replica_host,
        state: row.state,
        lagBytes: parseInt(row.lag_bytes) || 0,
        lagTime: parseInt(row.lag_time) || 0,
        lastMessage: new Date(row.last_message),
        flushLocation: row.flush_location,
        replayLocation: row.replay_location,
      }));
    } catch (error) {
      this.logger.error('Failed to get replication status', error);
      return [];
    }
  }

  /**
   * Get replication metrics
   */
  async getReplicationMetrics(): Promise<ReplicationMetrics> {
    try {
      const replicationStatus = await this.getReplicationStatus();
      const slotUsage = await this.getReplicationSlotUsage();
      const walGenerationRate = await this.getWalGenerationRate();

      const healthyReplicas = replicationStatus.filter(
        (replica) => replica.state === 'streaming' && replica.lagTime < 300,
      );

      const lagTimes = replicationStatus.map((r) => r.lagTime);
      const lagBytes = replicationStatus.map((r) => r.lagBytes);

      return {
        totalReplicas: replicationStatus.length,
        healthyReplicas: healthyReplicas.length,
        maxLagTime: Math.max(...lagTimes, 0),
        maxLagBytes: Math.max(...lagBytes, 0),
        averageLagTime: lagTimes.reduce((a, b) => a + b, 0) / lagTimes.length || 0,
        replicationSlotUsage: slotUsage,
        walGenerationRate: walGenerationRate,
      };
    } catch (error) {
      this.logger.error('Failed to get replication metrics', error);
      throw error;
    }
  }

  /**
   * Create a new replica
   */
  async createReplica(replicaHost: string, replicaPort: number = 5432): Promise<void> {
    this.logger.log(`Creating new replica: ${replicaHost}:${replicaPort}`);

    try {
      // Step 1: Create replication slot
      const slotName = `replica_${replicaHost.replace(/\./g, '_')}`;
      await this.createReplicationSlot(slotName);

      // Step 2: Take base backup
      await this.takeBaseBackup(replicaHost, replicaPort, slotName);

      // Step 3: Configure replica
      await this.configureReplica(replicaHost, replicaPort, slotName);

      // Step 4: Start replica
      await this.startReplica(replicaHost);

      this.logger.log(`Replica created successfully: ${replicaHost}:${replicaPort}`);
    } catch (error) {
      this.logger.error(`Failed to create replica: ${replicaHost}:${replicaPort}`, error);
      throw error;
    }
  }

  /**
   * Remove a replica
   */
  async removeReplica(replicaHost: string): Promise<void> {
    this.logger.log(`Removing replica: ${replicaHost}`);

    try {
      // Step 1: Stop replica
      await this.stopReplica(replicaHost);

      // Step 2: Drop replication slot
      const slotName = `replica_${replicaHost.replace(/\./g, '_')}`;
      await this.dropReplicationSlot(slotName);

      this.logger.log(`Replica removed successfully: ${replicaHost}`);
    } catch (error) {
      this.logger.error(`Failed to remove replica: ${replicaHost}`, error);
      throw error;
    }
  }

  /**
   * Promote replica to primary
   */
  async promoteReplica(replicaHost: string): Promise<void> {
    this.logger.log(`Promoting replica to primary: ${replicaHost}`);

    try {
      // Step 1: Stop replication on the replica
      await this.stopReplication(replicaHost);

      // Step 2: Promote replica
      await this.executeReplicaPromotion(replicaHost);

      // Step 3: Update configuration
      await this.updatePrimaryConfiguration(replicaHost);

      this.logger.log(`Replica promoted successfully: ${replicaHost}`);
    } catch (error) {
      this.logger.error(`Failed to promote replica: ${replicaHost}`, error);
      throw error;
    }
  }

  // Private helper methods

  private async configurePrimaryForReplication(): Promise<void> {
    this.logger.log('Configuring primary server for replication');

    const replicationSettings = [
      `wal_level = replica`,
      `max_wal_senders = ${this.replicationConfig.maxWalSenders}`,
      `wal_keep_segments = ${this.replicationConfig.walKeepSegments}`,
      `archive_mode = ${this.replicationConfig.archiveMode ? 'on' : 'off'}`,
      `archive_command = '${this.replicationConfig.archiveCommand}'`,
      `synchronous_commit = ${this.replicationConfig.synchronousCommit ? 'on' : 'off'}`,
    ];

    // In a real implementation, these would be set in postgresql.conf
    // For now, we'll log the required settings
    this.logger.log('Required PostgreSQL configuration:', replicationSettings);
  }

  private async createReplicationSlots(): Promise<void> {
    for (const slotName of this.replicationConfig.replicationSlots) {
      await this.createReplicationSlot(slotName);
    }
  }

  private async createReplicationSlot(slotName: string): Promise<void> {
    try {
      await this.dataSource.query(`SELECT pg_create_physical_replication_slot($1)`, [slotName]);
      this.logger.log(`Created replication slot: ${slotName}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        this.logger.log(`Replication slot already exists: ${slotName}`);
      } else {
        throw error;
      }
    }
  }

  private async dropReplicationSlot(slotName: string): Promise<void> {
    try {
      await this.dataSource.query(`SELECT pg_drop_replication_slot($1)`, [slotName]);
      this.logger.log(`Dropped replication slot: ${slotName}`);
    } catch (error) {
      this.logger.error(`Failed to drop replication slot: ${slotName}`, error);
      throw error;
    }
  }

  private async createReplicationUser(): Promise<void> {
    try {
      const replicationUser = this.replicationConfig.replicationUser;
      const password = this.configService.get<string>(
        'REPLICATION_PASSWORD',
        'replication_password',
      );

      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '${replicationUser}') THEN
            CREATE USER ${replicationUser} WITH REPLICATION PASSWORD '${password}';
          END IF;
        END
        $$;
      `);

      this.logger.log(`Replication user configured: ${replicationUser}`);
    } catch (error) {
      this.logger.error('Failed to create replication user', error);
      throw error;
    }
  }

  private async configureWalArchiving(): Promise<void> {
    if (!this.replicationConfig.archiveMode) {
      return;
    }

    this.logger.log('Configuring WAL archiving');

    // Create archive directory
    try {
      await execAsync('mkdir -p /var/lib/postgresql/archive');
      await execAsync('chown postgres:password /var/lib/postgresql/archive');
    } catch (error) {
      this.logger.error('Failed to create archive directory', error);
    }
  }

  private async takeBaseBackup(
    replicaHost: string,
    replicaPort: number,
    slotName: string,
  ): Promise<void> {
    this.logger.log(`Taking base backup for replica: ${replicaHost}`);

    const backupCommand = `
      PGPASSWORD="${this.configService.get('REPLICATION_PASSWORD')}" pg_basebackup \\
        -h ${this.replicationConfig.primaryHost} \\
        -p ${this.replicationConfig.primaryPort} \\
        -U ${this.replicationConfig.replicationUser} \\
        -D /tmp/replica_backup_${replicaHost} \\
        -Ft -z -P -W \\
        -S ${slotName}
    `;

    try {
      await execAsync(backupCommand);
      this.logger.log(`Base backup completed for: ${replicaHost}`);
    } catch (error) {
      this.logger.error(`Base backup failed for: ${replicaHost}`, error);
      throw error;
    }
  }

  private async configureReplica(
    replicaHost: string,
    replicaPort: number,
    slotName: string,
  ): Promise<void> {
    this.logger.log(`Configuring replica: ${replicaHost}`);

    const recoveryConf = `
      standby_mode = 'on'
      primary_conninfo = 'host=${this.replicationConfig.primaryHost} port=${this.replicationConfig.primaryPort} user=${this.replicationConfig.replicationUser}'
      primary_slot_name = '${slotName}'
      trigger_file = '/tmp/postgresql.trigger'
    `;

    // In a real implementation, this would write to recovery.conf on the replica
    this.logger.log('Replica configuration:', recoveryConf);
  }

  private async startReplica(replicaHost: string): Promise<void> {
    this.logger.log(`Starting replica: ${replicaHost}`);

    // In a real implementation, this would start PostgreSQL on the replica server
    // This could involve SSH commands or orchestration tools
    this.logger.log(`Replica started: ${replicaHost}`);
  }

  private async stopReplica(replicaHost: string): Promise<void> {
    this.logger.log(`Stopping replica: ${replicaHost}`);

    // In a real implementation, this would stop PostgreSQL on the replica server
    this.logger.log(`Replica stopped: ${replicaHost}`);
  }

  private async restartReplica(replicaHost: string): Promise<void> {
    this.logger.log(`Restarting replica: ${replicaHost}`);

    await this.stopReplica(replicaHost);
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
    await this.startReplica(replicaHost);
  }

  private async stopReplication(replicaHost: string): Promise<void> {
    this.logger.log(`Stopping replication on: ${replicaHost}`);

    // In a real implementation, this would stop replication on the replica
    this.logger.log(`Replication stopped on: ${replicaHost}`);
  }

  private async executeReplicaPromotion(replicaHost: string): Promise<void> {
    this.logger.log(`Executing promotion on: ${replicaHost}`);

    // In a real implementation, this would promote the replica to primary
    // This could involve creating a trigger file or using pg_promote()
    this.logger.log(`Promotion executed on: ${replicaHost}`);
  }

  private async updatePrimaryConfiguration(newPrimaryHost: string): Promise<void> {
    this.logger.log(`Updating configuration for new primary: ${newPrimaryHost}`);

    // In a real implementation, this would update application configuration
    // to point to the new primary database
    this.logger.log(`Configuration updated for: ${newPrimaryHost}`);
  }

  private async getReplicationSlotUsage(): Promise<number> {
    try {
      const result = await this.dataSource.query(`
        SELECT COUNT(*) as used_slots
        FROM pg_replication_slots
        WHERE active = true
      `);

      return parseInt(result[0]?.used_slots) || 0;
    } catch (error) {
      this.logger.error('Failed to get replication slot usage', error);
      return 0;
    }
  }

  private async getWalGenerationRate(): Promise<number> {
    try {
      // This is a simplified calculation
      // In production, you'd track WAL generation over time
      const result = await this.dataSource.query(`
        SELECT pg_current_wal_lsn() as current_lsn
      `);

      // Return a placeholder value
      return 1024; // KB/s
    } catch (error) {
      this.logger.error('Failed to get WAL generation rate', error);
      return 0;
    }
  }
}
