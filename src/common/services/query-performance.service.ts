import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * Service for monitoring and optimizing database query performance
 */
@Injectable()
export class QueryPerformanceService {
  private readonly logger = new Logger(QueryPerformanceService.name);
  private readonly slowQueryThresholdMs: number;
  private readonly enableQueryLogging: boolean;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.slowQueryThresholdMs = this.configService.get<number>('DB_SLOW_QUERY_THRESHOLD_MS', 100);
    this.enableQueryLogging = this.configService.get<boolean>('DB_QUERY_LOGGING', false);
  }

  /**
   * Execute a query with performance monitoring
   * @param query The SQL query to execute
   * @param parameters The query parameters
   * @returns The query result
   */
  async executeQuery<T>(query: string, parameters?: any[]): Promise<T> {
    const startTime = performance.now();
    let result: T;

    try {
      result = await this.dataSource.query(query, parameters);
    } catch (error) {
      this.logger.error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      const executionTime = performance.now() - startTime;
      
      if (executionTime > this.slowQueryThresholdMs) {
        this.logger.warn(`Slow query detected (${executionTime.toFixed(2)}ms): ${this.formatQuery(query, parameters)}`);
        this.recordSlowQuery(query, parameters, executionTime);
      } else if (this.enableQueryLogging) {
        this.logger.debug(`Query executed (${executionTime.toFixed(2)}ms): ${this.formatQuery(query, parameters)}`);
      }
    }

    return result;
  }

  /**
   * Create a query runner with performance monitoring
   * @returns A query runner with performance monitoring
   */
  async createQueryRunner(): Promise<QueryRunner> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    // Wrap the original executeQuery method to add performance monitoring
    const originalExecute = queryRunner.query.bind(queryRunner);
    
    queryRunner.query = async (query: string, parameters?: any[]): Promise<any> => {
      const startTime = performance.now();
      let result;
      
      try {
        result = await originalExecute(query, parameters);
        return result;
      } finally {
        const executionTime = performance.now() - startTime;
        
        if (executionTime > this.slowQueryThresholdMs) {
          this.logger.warn(`Slow query detected (${executionTime.toFixed(2)}ms): ${this.formatQuery(query, parameters)}`);
          this.recordSlowQuery(query, parameters, executionTime);
        } else if (this.enableQueryLogging) {
          this.logger.debug(`Query executed (${executionTime.toFixed(2)}ms): ${this.formatQuery(query, parameters)}`);
        }
      }
    };
    
    return queryRunner;
  }

  /**
   * Format a query for logging
   * @param query The SQL query
   * @param parameters The query parameters
   * @returns The formatted query
   */
  private formatQuery(query: string, parameters?: any[]): string {
    if (!parameters || parameters.length === 0) {
      return query;
    }
    
    // Simple parameter redaction for sensitive data
    const redactedParams = parameters.map(param => {
      if (typeof param === 'string' && (
        param.toLowerCase().includes('password') || 
        param.toLowerCase().includes('token') || 
        param.toLowerCase().includes('secret')
      )) {
        return '***REDACTED***';
      }
      return param;
    });
    
    return `${query} -- Parameters: ${JSON.stringify(redactedParams)}`;
  }

  /**
   * Record a slow query for analysis
   * @param query The SQL query
   * @param parameters The query parameters
   * @param executionTimeMs The execution time in milliseconds
   */
  private recordSlowQuery(query: string, parameters: any[] | undefined, executionTimeMs: number): void {
    // In a production environment, this would store the slow query in a database or send it to a monitoring service
    // For now, we'll just log it with additional context
    const timestamp = new Date().toISOString();
    const queryInfo = {
      timestamp,
      query: this.formatQuery(query, parameters),
      executionTimeMs,
      // Add additional context like stack trace or request ID if available
    };
    
    this.logger.warn(`Slow query recorded: ${JSON.stringify(queryInfo)}`);
  }
}
