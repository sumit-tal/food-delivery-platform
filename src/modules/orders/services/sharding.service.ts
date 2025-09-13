import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for handling database sharding
 */
@Injectable()
export class ShardingService {
  private readonly logger = new Logger(ShardingService.name);
  private readonly shardCount: number;

  constructor(private readonly configService: ConfigService) {
    // Get the shard count from the configuration
    this.shardCount = this.configService.get<number>('DB_SHARD_COUNT', 16);
    this.logger.log(`Initialized sharding service with ${this.shardCount} shards`);
  }

  /**
   * Calculate the shard key for an order ID
   * @param orderId The order ID
   * @returns The shard key
   */
  calculateShardKey(orderId: string): number {
    // Extract the first 8 characters of the UUID and convert to a number
    const hexSubstring = orderId.replace(/-/g, '').substring(0, 8);
    const numericValue = parseInt(hexSubstring, 16);
    
    // Modulo to get a value between 0 and shardCount - 1
    return numericValue % this.shardCount;
  }

  /**
   * Generate a new order ID with a specific shard key
   * @param targetShardKey Optional target shard key
   * @returns An object containing the order ID and shard key
   */
  generateOrderId(targetShardKey?: number): { orderId: string; shardKey: number } {
    // If no target shard key is specified, generate a random UUID
    if (targetShardKey === undefined) {
      const orderId = uuidv4();
      const shardKey = this.calculateShardKey(orderId);
      return { orderId, shardKey };
    }

    // Ensure the target shard key is valid
    if (targetShardKey < 0 || targetShardKey >= this.shardCount) {
      throw new Error(`Invalid shard key: ${targetShardKey}. Must be between 0 and ${this.shardCount - 1}`);
    }

    // Generate UUIDs until we find one that maps to the target shard key
    let attempts = 0;
    const maxAttempts = 1000; // Prevent infinite loop
    
    while (attempts < maxAttempts) {
      const orderId = uuidv4();
      const shardKey = this.calculateShardKey(orderId);
      
      if (shardKey === targetShardKey) {
        return { orderId, shardKey };
      }
      
      attempts++;
    }
    
    throw new Error(`Failed to generate order ID with shard key ${targetShardKey} after ${maxAttempts} attempts`);
  }

  /**
   * Get the database connection string for a shard
   * @param shardKey The shard key
   * @returns The database connection string
   */
  getShardConnectionString(shardKey: number): string {
    // Ensure the shard key is valid
    if (shardKey < 0 || shardKey >= this.shardCount) {
      throw new Error(`Invalid shard key: ${shardKey}. Must be between 0 and ${this.shardCount - 1}`);
    }
    
    // Get the base connection string from the configuration
    const baseConnectionString = this.configService.get<string>(
      'DB_CONNECTION_STRING', 
      'postgresql://postgres:postgres@localhost:5432/swifteats'
    );
    
    // For a real implementation, you would have different connection strings for each shard
    // For now, we'll just append the shard key to the database name
    return `${baseConnectionString}_shard_${shardKey}`;
  }

  /**
   * Get the shard key for a specific entity
   * @param entityType The type of entity
   * @param entityId The entity ID
   * @returns The shard key
   */
  getEntityShardKey(entityType: string, entityId: string): number {
    switch (entityType) {
      case 'order':
        return this.calculateShardKey(entityId);
      case 'user':
        // For user-related data, you might want to use a different sharding strategy
        // For simplicity, we'll use the same strategy as orders
        return this.calculateShardKey(entityId);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Get the number of shards
   * @returns The number of shards
   */
  getShardCount(): number {
    return this.shardCount;
  }
}
