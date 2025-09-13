import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service for managing WebSocket client connections
 * Handles connection limits and tracking
 */
@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private readonly connections = new Map<string, ConnectionInfo>();
  private readonly maxConnections: number;

  constructor(private readonly configService: ConfigService) {
    this.maxConnections = this.configService.get<number>('MAX_CONCURRENT_CONNECTIONS', 10000);
  }

  /**
   * Register a new client connection
   */
  registerConnection(clientId: string, metadata: Record<string, any> = {}): void {
    if (this.connections.size >= this.maxConnections) {
      throw new Error(`Connection limit reached (${this.maxConnections})`);
    }

    this.connections.set(clientId, {
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata,
    });

    // Log connection metrics periodically
    if (this.connections.size % 100 === 0) {
      this.logger.log(`Active connections: ${this.connections.size}`);
    }
  }

  /**
   * Update client connection metadata
   */
  updateConnection(clientId: string, metadata: Record<string, any>): void {
    const connection = this.connections.get(clientId);
    if (!connection) {
      return;
    }

    this.connections.set(clientId, {
      ...connection,
      lastActivity: new Date(),
      metadata: {
        ...connection.metadata,
        ...metadata,
      },
    });
  }

  /**
   * Record client activity to update last activity timestamp
   */
  recordActivity(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (!connection) {
      return;
    }

    connection.lastActivity = new Date();
  }

  /**
   * Unregister a client connection
   */
  unregisterConnection(clientId: string): void {
    this.connections.delete(clientId);
  }

  /**
   * Get the current number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connection information for a specific client
   */
  getConnection(clientId: string): ConnectionInfo | undefined {
    return this.connections.get(clientId);
  }

  /**
   * Get all active connections
   */
  getAllConnections(): Map<string, ConnectionInfo> {
    return new Map(this.connections);
  }

  /**
   * Find inactive connections based on a timeout threshold
   */
  findInactiveConnections(inactiveThresholdMs: number): string[] {
    const now = Date.now();
    const inactiveClientIds: string[] = [];

    this.connections.forEach((info, clientId) => {
      const lastActivityTime = info.lastActivity.getTime();
      if (now - lastActivityTime > inactiveThresholdMs) {
        inactiveClientIds.push(clientId);
      }
    });

    return inactiveClientIds;
  }
}

/**
 * Interface for connection information
 */
interface ConnectionInfo {
  connectedAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}
