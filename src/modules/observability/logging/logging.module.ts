import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingService } from './logging.service';
import { ElasticsearchLoggerService } from './elasticsearch-logger.service';

/**
 * LoggingModule provides functionality for centralized logging.
 * It includes services for log collection, formatting, and shipping to Elasticsearch.
 */
@Module({
  imports: [ConfigModule],
  providers: [LoggingService, ElasticsearchLoggerService],
  exports: [LoggingService, ElasticsearchLoggerService],
})
export class LoggingModule {}
