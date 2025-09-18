import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

/**
 * Service for optimizing database indexes
 */
@Injectable()
export class IndexOptimizationService implements OnModuleInit {
  private readonly logger = new Logger(IndexOptimizationService.name);
  private readonly enableIndexAnalysis: boolean;
  private readonly indexAnalysisIntervalMs: number;
  private indexAnalysisInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.enableIndexAnalysis = this.configService.get<boolean>('DB_ENABLE_INDEX_ANALYSIS', false);
    this.indexAnalysisIntervalMs = this.configService.get<number>('DB_INDEX_ANALYSIS_INTERVAL_MS', 86400000); // Default: once per day
  }

  /**
   * Initialize index analysis when the module is initialized
   */
  async onModuleInit(): Promise<void> {
    if (this.enableIndexAnalysis) {
      await this.analyzeIndexUsage();
      this.startPeriodicIndexAnalysis();
    }
  }

  /**
   * Start periodic index analysis
   */
  private startPeriodicIndexAnalysis(): void {
    if (this.indexAnalysisInterval) {
      return;
    }
    
    this.indexAnalysisInterval = setInterval(async () => {
      try {
        await this.analyzeIndexUsage();
      } catch (error) {
        this.logger.error(`Error analyzing index usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, this.indexAnalysisIntervalMs);
    
    this.logger.log(`Periodic index analysis scheduled every ${this.indexAnalysisIntervalMs / 1000 / 60 / 60} hours`);
  }

  /**
   * Stop periodic index analysis
   */
  stopPeriodicIndexAnalysis(): void {
    if (this.indexAnalysisInterval) {
      clearInterval(this.indexAnalysisInterval);
      this.indexAnalysisInterval = null;
      this.logger.log('Periodic index analysis stopped');
    }
  }

  /**
   * Analyze index usage
   */
  async analyzeIndexUsage(): Promise<void> {
    try {
      this.logger.log('Starting index usage analysis');
      
      // Reset index statistics
      await this.dataSource.query('SELECT pg_stat_reset()');
      
      // Get unused indexes
      const unusedIndexes = await this.getUnusedIndexes();
      if (unusedIndexes.length > 0) {
        this.logger.warn(`Found ${unusedIndexes.length} unused indexes: ${unusedIndexes.map(idx => idx.indexName).join(', ')}`);
      } else {
        this.logger.log('No unused indexes found');
      }
      
      // Get missing indexes
      const missingIndexes = await this.getMissingIndexes();
      if (missingIndexes.length > 0) {
        this.logger.warn(`Found ${missingIndexes.length} potential missing indexes: ${missingIndexes.map(idx => `${idx.tableName}(${idx.columnName})`).join(', ')}`);
      } else {
        this.logger.log('No missing indexes identified');
      }
      
      // Get duplicate indexes
      const duplicateIndexes = await this.getDuplicateIndexes();
      if (duplicateIndexes.length > 0) {
        this.logger.warn(`Found ${duplicateIndexes.length} duplicate indexes: ${duplicateIndexes.map(idx => idx.indexName).join(', ')}`);
      } else {
        this.logger.log('No duplicate indexes found');
      }
      
      this.logger.log('Index usage analysis completed');
    } catch (error) {
      this.logger.error(`Error during index analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get unused indexes
   * @returns List of unused indexes
   */
  private async getUnusedIndexes(): Promise<Array<{ indexName: string; tableName: string; indexSize: string }>> {
    const result = await this.dataSource.query(`
      SELECT
        idxs.indexrelname AS "indexName",
        tbl.relname AS "tableName",
        pg_size_pretty(pg_relation_size(idxs.indexrelid)) AS "indexSize"
      FROM
        pg_stat_user_indexes AS idxs
        JOIN pg_index AS i ON i.indexrelid = idxs.indexrelid
        JOIN pg_stat_user_tables AS tbl ON idxs.relid = tbl.relid
      WHERE
        idxs.idx_scan = 0 -- No scans
        AND NOT i.indisprimary -- Not a primary key
        AND NOT i.indisunique -- Not a unique constraint
      ORDER BY
        pg_relation_size(idxs.indexrelid) DESC;
    `);
    
    return result;
  }

  /**
   * Get potential missing indexes
   * @returns List of potential missing indexes
   */
  private async getMissingIndexes(): Promise<Array<{ tableName: string; columnName: string; seqScans: number }>> {
    const result = await this.dataSource.query(`
      SELECT
        tbl.relname AS "tableName",
        a.attname AS "columnName",
        s.n_live_tup AS "rowCount",
        s.seq_scan AS "seqScans",
        s.seq_tup_read AS "seqReads"
      FROM
        pg_stat_user_tables s
        JOIN pg_class tbl ON tbl.oid = s.relid
        JOIN pg_attribute a ON a.attrelid = s.relid
      WHERE
        a.attnum > 0
        AND NOT a.attisdropped
        AND a.attname LIKE '%_id'
        AND s.seq_scan > 10
        AND s.n_live_tup > 1000
      ORDER BY
        s.seq_scan DESC,
        s.seq_tup_read DESC
      LIMIT 10;
    `);
    
    return result;
  }

  /**
   * Get duplicate indexes
   * @returns List of duplicate indexes
   */
  private async getDuplicateIndexes(): Promise<Array<{ indexName: string; tableName: string; indexDef: string }>> {
    const result = await this.dataSource.query(`
      WITH index_cols AS (
        SELECT
          i.indrelid,
          i.indexrelid,
          array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum)) AS cols
        FROM
          pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        GROUP BY
          i.indrelid, i.indexrelid
      )
      SELECT
        idx1.relname AS "indexName",
        tbl.relname AS "tableName",
        pg_get_indexdef(idx1.oid) AS "indexDef"
      FROM
        index_cols ic1
        JOIN index_cols ic2 ON ic1.indrelid = ic2.indrelid
          AND ic1.indexrelid > ic2.indexrelid
          AND ic1.cols @> ic2.cols
        JOIN pg_class idx1 ON idx1.oid = ic1.indexrelid
        JOIN pg_class idx2 ON idx2.oid = ic2.indexrelid
        JOIN pg_class tbl ON tbl.oid = ic1.indrelid
      ORDER BY
        tbl.relname, idx1.relname;
    `);
    
    return result;
  }

  /**
   * Create an optimized index
   * @param tableName The table name
   * @param columnName The column name
   * @param indexName Optional index name
   * @returns The result of the index creation
   */
  async createIndex(tableName: string, columnName: string, indexName?: string): Promise<void> {
    try {
      const actualIndexName = indexName || `idx_${tableName}_${columnName}`;
      
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS ${actualIndexName} ON ${tableName} (${columnName});
      `);
      
      this.logger.log(`Created index ${actualIndexName} on ${tableName}(${columnName})`);
    } catch (error) {
      this.logger.error(`Error creating index: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Drop an unused index
   * @param indexName The index name
   * @returns The result of the index drop
   */
  async dropIndex(indexName: string): Promise<void> {
    try {
      await this.dataSource.query(`
        DROP INDEX IF EXISTS ${indexName};
      `);
      
      this.logger.log(`Dropped index ${indexName}`);
    } catch (error) {
      this.logger.error(`Error dropping index: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Reindex a table
   * @param tableName The table name
   * @returns The result of the reindex
   */
  async reindexTable(tableName: string): Promise<void> {
    try {
      await this.dataSource.query(`
        REINDEX TABLE ${tableName};
      `);
      
      this.logger.log(`Reindexed table ${tableName}`);
    } catch (error) {
      this.logger.error(`Error reindexing table: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
