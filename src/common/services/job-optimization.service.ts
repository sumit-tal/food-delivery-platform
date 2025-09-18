import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { RedisOptions } from 'ioredis';

/**
 * Service for optimizing background job processing
 */
@Injectable()
export class JobOptimizationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobOptimizationService.name);
  private readonly redisOptions: RedisOptions;
  private readonly concurrency: number;
  private readonly maxStalledCount: number;
  private readonly stalledInterval: number;
  private readonly enableMetrics: boolean;
  private readonly metricsIntervalMs: number;
  private readonly defaultJobOptions: Record<string, unknown>;

  private workers: Record<string, Worker> = {};
  private schedulers: Record<string, Queue> = {};
  private queueEvents: Record<string, QueueEvents> = {};
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {
    this.redisOptions = this.buildRedisOptions();
    this.concurrency = this.configService.get<number>('JOB_CONCURRENCY', 10);
    this.maxStalledCount = this.configService.get<number>('JOB_MAX_STALLED_COUNT', 3);
    this.stalledInterval = this.configService.get<number>('JOB_STALLED_INTERVAL', 30000);
    this.enableMetrics = this.configService.get<boolean>('JOB_ENABLE_METRICS', true);
    this.metricsIntervalMs = this.configService.get<number>('JOB_METRICS_INTERVAL_MS', 60000);
    this.defaultJobOptions = this.buildDefaultJobOptions();
  }

  /**
   * Build Redis connection options
   */
  private buildRedisOptions(): RedisOptions {
    return {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', ''),
      db: this.configService.get<number>('REDIS_DB', 0),
      maxRetriesPerRequest: this.configService.get<number>('REDIS_MAX_RETRIES', 10),
      enableReadyCheck: true,
      enableOfflineQueue: true,
      connectTimeout: this.configService.get<number>('REDIS_CONNECT_TIMEOUT', 10000),
    };
  }

  /**
   * Build default job options
   */
  private buildDefaultJobOptions(): Record<string, unknown> {
    return {
      attempts: this.configService.get<number>('JOB_DEFAULT_ATTEMPTS', 3),
      backoff: {
        type: 'exponential',
        delay: this.configService.get<number>('JOB_BACKOFF_DELAY', 1000),
      },
      removeOnComplete: this.configService.get<boolean>('JOB_REMOVE_ON_COMPLETE', true),
      removeOnFail: this.configService.get<number>('JOB_REMOVE_ON_FAIL', 1000),
    };
  }

  /**
   * Initialize the job optimization service
   */
  onModuleInit(): void {
    if (this.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  /**
   * Clean up resources when the module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    this.stopMetricsCollection();

    // Close all workers
    await Promise.all(Object.values(this.workers).map((worker) => worker.close()));

    // Close all schedulers (queues)
    await Promise.all(Object.values(this.schedulers).map((scheduler) => scheduler.close()));

    // Close all queue events
    await Promise.all(Object.values(this.queueEvents).map((queueEvents) => queueEvents.close()));

    this.logger.log('All job processing resources closed');
  }

  /**
   * Create an optimized queue
   * @param queueName The queue name
   * @returns The optimized queue
   */
  createQueue(queueName: string): Queue {
    const queue = new Queue(queueName, {
      connection: this.redisOptions,
      defaultJobOptions: this.defaultJobOptions,
    });

    this.logger.log(`Created optimized queue: ${queueName}`);
    return queue;
  }

  /**
   * Create an optimized worker
   * @param queueName The queue name
   * @param processor The job processor function
   * @returns The optimized worker
   */
  createWorker<T, R = unknown>(
    queueName: string,
    processor: (job: Job<T>) => Promise<R>,
  ): Worker<T, R> {
    const worker = new Worker<T, R>(queueName, processor, {
      connection: this.redisOptions,
      concurrency: this.concurrency,
      maxStalledCount: this.maxStalledCount,
      stalledInterval: this.stalledInterval,
    });

    this.setupWorkerEventHandlers(worker, queueName);
    this.workers[queueName] = worker;

    this.logger.log(
      `Created optimized worker for queue: ${queueName} with concurrency ${this.concurrency}`,
    );
    return worker;
  }

  /**
   * Set up event handlers for a worker
   * @param worker The worker instance
   * @param queueName The queue name
   */
  private setupWorkerEventHandlers<T, R>(worker: Worker<T, R>, queueName: string): void {
    worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed in queue ${queueName}: ${err.message}`);
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker error in queue ${queueName}: ${err.message}`);
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled in queue ${queueName}`);
    });
  }

  /**
   * Create a queue scheduler for delayed jobs
   * Note: QueueScheduler is deprecated in BullMQ v5+
   * Delayed jobs are now handled automatically by the queue
   * @param queueName The queue name
   * @returns The queue for scheduling
   */
  createScheduler(queueName: string): Queue {
    const queue = this.createQueue(queueName);

    // Store the queue reference for cleanup
    this.schedulers[queueName] = queue;

    this.logger.log(`Queue scheduler functionality enabled for queue: ${queueName}`);
    return queue;
  }

  /**
   * Create queue events for monitoring
   * @param queueName The queue name
   * @returns The queue events
   */
  createQueueEvents(queueName: string): QueueEvents {
    const queueEvents = new QueueEvents(queueName, {
      connection: this.redisOptions,
    });

    // Store the queue events for cleanup
    this.queueEvents[queueName] = queueEvents;

    this.logger.log(`Created queue events for queue: ${queueName}`);
    return queueEvents;
  }

  /**
   * Start collecting job metrics
   */
  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      return;
    }

    this.metricsInterval = setInterval(() => {
      try {
        this.collectMetrics();
      } catch (error) {
        this.logger.error(
          `Error collecting job metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }, this.metricsIntervalMs);

    this.logger.log(`Job metrics collection started (interval: ${this.metricsIntervalMs}ms)`);
  }

  /**
   * Stop collecting job metrics
   */
  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      this.logger.log('Job metrics collection stopped');
    }
  }

  /**
   * Collect job metrics
   */
  private collectMetrics(): void {
    for (const [queueName, worker] of Object.entries(this.workers)) {
      try {
        // Note: getMetrics() is not available in BullMQ Worker
        // Using alternative approach to get worker information
        const isRunning = !worker.closing;
        const metrics = {
          isRunning,
          concurrency: this.concurrency,
          queueName,
        };

        this.logger.debug(`Queue ${queueName} metrics: ${JSON.stringify(metrics)}`);
      } catch (error) {
        this.logger.error(
          `Error collecting metrics for queue ${queueName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  /**
   * Optimize job batching
   * @param queue The queue
   * @param jobs The jobs to batch
   * @returns The job IDs
   */
  async addBatchJobs<T>(
    queue: Queue,
    jobs: Array<{ name: string; data: T; opts?: Record<string, unknown> }>,
  ): Promise<string[]> {
    try {
      // Prepare jobs with optimized options
      const jobsToAdd = jobs.map((job) => ({
        name: job.name,
        data: job.data,
        opts: {
          ...this.defaultJobOptions,
          ...job.opts,
        },
      }));

      // Add jobs in a batch
      const result = await queue.addBulk(jobsToAdd);

      // Extract job IDs, filtering out undefined values
      const jobIds = result.map((job) => job.id).filter((id): id is string => id !== undefined);

      this.logger.debug(`Added ${jobIds.length} jobs to queue ${queue.name} in batch`);

      return jobIds;
    } catch (error) {
      this.logger.error(
        `Error adding batch jobs to queue ${queue.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get queue statistics
   * @param queue The queue
   * @returns The queue statistics
   */
  async getQueueStats(queue: Queue): Promise<Record<string, number>> {
    try {
      const counts = await this.fetchQueueCounts(queue);
      return this.buildQueueStatsResponse(counts);
    } catch (error) {
      this.logger.error(
        `Error getting queue stats for ${queue.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Fetch all queue counts
   * @param queue The queue
   * @returns Array of counts
   */
  private async fetchQueueCounts(queue: Queue): Promise<number[]> {
    return Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
  }

  /**
   * Build queue stats response object
   * @param counts Array of queue counts
   * @returns Queue statistics object
   */
  private buildQueueStatsResponse(counts: number[]): Record<string, number> {
    const [waiting, active, completed, failed, delayed] = counts;
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }
}
