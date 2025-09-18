import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';

/**
 * Service for optimizing WebSocket connections for real-time services
 */
@Injectable()
export class WebSocketOptimizationService {
  private readonly logger = new Logger(WebSocketOptimizationService.name);
  private readonly pingInterval: number;
  private readonly pingTimeout: number;
  private readonly maxHttpBufferSize: number;
  private readonly maxConnections: number;
  private readonly enableCompression: boolean;
  private readonly enableMetrics: boolean;
  private readonly metricsIntervalMs: number;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {
    this.pingInterval = this.configService.get<number>('WS_PING_INTERVAL', 25000);
    this.pingTimeout = this.configService.get<number>('WS_PING_TIMEOUT', 10000);
    this.maxHttpBufferSize = this.configService.get<number>('WS_MAX_HTTP_BUFFER_SIZE', 1e6);
    this.maxConnections = this.configService.get<number>('WS_MAX_CONNECTIONS', 10000);
    this.enableCompression = this.configService.get<boolean>('WS_ENABLE_COMPRESSION', true);
    this.enableMetrics = this.configService.get<boolean>('WS_ENABLE_METRICS', true);
    this.metricsIntervalMs = this.configService.get<number>('WS_METRICS_INTERVAL_MS', 60000);
  }

  /**
   * Apply optimizations to a WebSocket server
   * @param server The WebSocket server
   */
  optimizeWebSocketServer(server: Server): void {
    this.logger.log('Applying WebSocket optimizations');
    
    // Configure server options
    if (server.engine) {
      server.engine.opts = {
        ...server.engine.opts,
        pingInterval: this.pingInterval,
        pingTimeout: this.pingTimeout,
        maxHttpBufferSize: this.maxHttpBufferSize,
        perMessageDeflate: this.enableCompression ? {
          threshold: 1024, // Only compress messages larger than 1KB
          zlibDeflateOptions: {
            chunkSize: 16 * 1024, // 16KB
            memLevel: 7, // Memory level 1-9 (9 = best compression, more memory)
            level: 3, // Compression level 1-9 (9 = best compression, slower)
          },
        } : false,
      };
      
      // Set up connection limits (using any to bypass TypeScript errors)
      (server.engine as any).maxConnections = this.maxConnections;
    }
    
    // Set up metrics collection
    if (this.enableMetrics) {
      this.startMetricsCollection(server);
    }
    
    this.logger.log(`WebSocket optimizations applied: pingInterval=${this.pingInterval}ms, pingTimeout=${this.pingTimeout}ms, compression=${this.enableCompression}`);
  }

  /**
   * Start collecting WebSocket metrics
   * @param server The WebSocket server
   */
  private startMetricsCollection(server: Server): void {
    if (this.metricsInterval) {
      return;
    }
    
    this.metricsInterval = setInterval(() => {
      try {
        const metrics = this.collectMetrics(server);
        this.logger.debug(`WebSocket metrics: ${JSON.stringify(metrics)}`);
      } catch (error) {
        this.logger.error(`Error collecting WebSocket metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, this.metricsIntervalMs);
    
    this.logger.log(`WebSocket metrics collection started (interval: ${this.metricsIntervalMs}ms)`);
  }

  /**
   * Stop collecting WebSocket metrics
   */
  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      this.logger.log('WebSocket metrics collection stopped');
    }
  }

  /**
   * Collect WebSocket metrics
   * @param server The WebSocket server
   * @returns The WebSocket metrics
   */
  private collectMetrics(server: Server): Record<string, number> {
    // Calculate metrics
    const metrics: Record<string, number> = {
      totalConnections: 0,
    };
    
    try {
      // Get namespaces (using any to bypass TypeScript errors)
      const nsps = (server as any)._nsps || {};
      const namespaces = Object.keys(nsps);
      
      // Count connections per namespace
      namespaces.forEach(namespace => {
        const nsp = nsps[namespace];
        if (nsp && nsp.sockets) {
          const connectionCount = Object.keys(nsp.sockets).length;
          metrics[`connections_${namespace}`] = connectionCount;
          metrics.totalConnections += connectionCount;
        }
      });
    } catch (err) {
      this.logger.error(`Error collecting WebSocket metrics: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    return metrics;
  }

  /**
   * Apply optimizations to a specific namespace
   * @param server The WebSocket server
   * @param namespace The namespace
   */
  optimizeNamespace(server: Server, namespace: string): void {
    const nsp = server.of(namespace);
    
    // Apply middleware for rate limiting
    nsp.use((socket, next) => {
      // Implement rate limiting
      const clientIp = socket.handshake.address;
      // const clientId = socket.id; // Uncomment if needed
      
      // Simple in-memory rate limiting (in production, use Redis for distributed rate limiting)
      // Check if this IP is rate-limited
      const isRateLimited = this.checkRateLimit(clientIp, namespace);
      
      if (isRateLimited) {
        this.logger.warn(`Rate limit exceeded for ${clientIp} on namespace ${namespace}`);
        return next(new Error('Rate limit exceeded'));
      }
      
      // Continue with the connection
      next();
    });
    
    this.logger.log(`Optimizations applied to namespace: ${namespace}`);
  }

  /**
   * Check if a client is rate-limited
   * @param clientIp The client IP address
   * @param namespace The namespace
   * @returns True if the client is rate-limited
   */
  private checkRateLimit(clientIp: string, namespace: string): boolean {
    // In a real implementation, this would use Redis or another distributed store
    // For now, we'll use a simple in-memory approach
    
    // This is just a placeholder implementation
    return false;
  }

  /**
   * Batch WebSocket messages for efficiency
   * @param messages The messages to batch
   * @returns The batched messages
   */
  batchMessages<T>(messages: Array<{ event: string; data: T; room?: string }>): Array<{ event: string; data: T[]; room?: string }> {
    // Group messages by event and room
    const batches: Record<string, { event: string; data: T[]; room?: string }> = {};
    
    messages.forEach(message => {
      const key = `${message.event}:${message.room || 'global'}`;
      
      if (!batches[key]) {
        batches[key] = {
          event: message.event,
          data: [],
          room: message.room,
        };
      }
      
      batches[key].data.push(message.data);
    });
    
    return Object.values(batches);
  }

  /**
   * Send batched messages to clients
   * @param server The WebSocket server
   * @param namespace The namespace
   * @param batchedMessages The batched messages
   */
  sendBatchedMessages<T>(server: Server, namespace: string, batchedMessages: Array<{ event: string; data: T[]; room?: string }>): void {
    const nsp = server.of(namespace);
    
    batchedMessages.forEach(batch => {
      if (batch.room) {
        nsp.to(batch.room).emit(batch.event, batch.data);
      } else {
        nsp.emit(batch.event, batch.data);
      }
    });
  }
}
