import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as elasticsearch from '@elastic/elasticsearch';
import { getBoolean } from '../../../common/utils/config.utils';

/**
 * ElasticsearchLoggerService provides functionality for sending logs to Elasticsearch.
 * It handles connection to Elasticsearch and log shipping.
 */
@Injectable()
export class ElasticsearchLoggerService implements OnModuleInit {
  private client: elasticsearch.Client | null = null;
  private readonly enabled: boolean;
  private readonly indexPrefix: string;
  private readonly bulkSize: number;
  private readonly flushInterval: number;
  private logBuffer: Record<string, unknown>[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  public constructor(private readonly configService: ConfigService) {
    this.enabled = getBoolean(this.configService, 'ELASTICSEARCH_ENABLED', false);
    this.indexPrefix = this.configService.get<string>(
      'ELASTICSEARCH_INDEX_PREFIX',
      'swifteats-logs',
    );
    this.bulkSize = this.configService.get<number>('ELASTICSEARCH_BULK_SIZE', 100);
    this.flushInterval = this.configService.get<number>('ELASTICSEARCH_FLUSH_INTERVAL', 5000);
  }

  /**
   * Initialize Elasticsearch client when module starts.
   */
  public async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.initializeElasticsearchClient();
      this.isConnected = true;
      this.startFlushTimer();
    } catch (error) {
      console.error('Failed to connect to Elasticsearch', error);
      this.isConnected = false;
    }
  }

  /**
   * Initialize the Elasticsearch client with configuration options.
   */
  private async initializeElasticsearchClient(): Promise<void> {
    const node = this.configService.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200');
    const username = this.configService.get<string>('ELASTICSEARCH_USERNAME');
    const password = this.configService.get<string>('ELASTICSEARCH_PASSWORD');

    const clientOptions: elasticsearch.ClientOptions = { node };

    if (username && password) {
      clientOptions.auth = { username, password };
    }

    this.client = new elasticsearch.Client(clientOptions);
    await this.client.ping();
  }

  /**
   * Start the timer for flushing logs to Elasticsearch.
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      void this.flush().catch((error) => {
        console.error('Error during scheduled log flush:', error);
      });
    }, this.flushInterval);
  }

  /**
   * Log a message to Elasticsearch.
   * @param log - Log object to send to Elasticsearch
   */
  public log(log: Record<string, unknown>): void {
    if (!this.enabled || !this.isConnected) {
      return;
    }

    this.logBuffer.push(log);

    if (this.logBuffer.length >= this.bulkSize) {
      void this.flush().catch((error) => {
        console.error('Error during bulk size flush:', error);
      });
    }
  }

  /**
   * Flush logs to Elasticsearch.
   */
  private async flush(): Promise<void> {
    if (!this.enabled || !this.isConnected || !this.client || this.logBuffer.length === 0) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const indexName = `${this.indexPrefix}-${new Date().toISOString().slice(0, 10)}`;
      const body = logs.flatMap((log) => [{ index: { _index: indexName } }, log]);

      await this.client.bulk({ body });
    } catch (error) {
      console.error('Failed to send logs to Elasticsearch', error);
      // Put logs back in buffer for retry
      this.logBuffer = [...logs, ...this.logBuffer];
      // Trim buffer if it gets too large
      if (this.logBuffer.length > this.bulkSize * 2) {
        this.logBuffer = this.logBuffer.slice(-this.bulkSize);
      }
    }
  }
}
