import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../services/database.service';
import { ActiveDelivery as ActiveDeliveryInterface } from '../interfaces';
import { IActiveDeliveryRepository } from './active-delivery.repository.interface';

/**
 * Interface for active delivery data
 */
export interface ActiveDelivery {
  id: string;
  order_id: string;
  driver_id: string;
  status: string;
  pickup_longitude: number;
  pickup_latitude: number;
  delivery_longitude: number;
  delivery_latitude: number;
  started_at: string;
  estimated_delivery_time: string | null;
  completed_at: string | null;
}

/**
 * Repository for active delivery data operations
 */
@Injectable()
export class ActiveDeliveryRepository implements IActiveDeliveryRepository {
  private readonly logger = new Logger(ActiveDeliveryRepository.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Find the active order ID for a driver
   */
  async findActiveOrderByDriverId(driverId: string): Promise<string | null> {
    try {
      const result = await this.databaseService.query<{ order_id: string }>(
        `SELECT order_id
         FROM active_deliveries
         WHERE driver_id = $1 AND status != 'completed'
         ORDER BY started_at DESC
         LIMIT 1`,
        [driverId]
      );
      
      return result.rows.length > 0 ? result.rows[0].order_id : null;
    } catch (error) {
      this.logger.error(`Error finding active order: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Find the driver ID for an active order
   */
  async findDriverByOrderId(orderId: string): Promise<string | null> {
    try {
      const result = await this.databaseService.query<{ driver_id: string }>(
        `SELECT driver_id
         FROM active_deliveries
         WHERE order_id = $1 AND status != 'completed'
         LIMIT 1`,
        [orderId]
      );
      
      return result.rows.length > 0 ? result.rows[0].driver_id : null;
    } catch (error) {
      this.logger.error(`Error finding driver for order: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Create a new active delivery
   */
  async createActiveDelivery(
    orderId: string,
    driverId: string,
    pickupLatitude: number,
    pickupLongitude: number,
    deliveryLatitude: number,
    deliveryLongitude: number,
    estimatedDeliveryTime?: Date
  ): Promise<string> {
    try {
      return this.insertActiveDelivery(
        orderId,
        driverId,
        pickupLatitude,
        pickupLongitude,
        deliveryLatitude,
        deliveryLongitude,
        estimatedDeliveryTime
      );
    } catch (error) {
      this.logger.error(`Error creating active delivery: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Helper method to insert active delivery record
   */
  private async insertActiveDelivery(
    orderId: string,
    driverId: string,
    pickupLatitude: number,
    pickupLongitude: number,
    deliveryLatitude: number,
    deliveryLongitude: number,
    estimatedDeliveryTime?: Date
  ): Promise<string> {
    // Prepare query parameters
    const params = [
      orderId,
      driverId,
      pickupLongitude,
      pickupLatitude,
      deliveryLongitude,
      deliveryLatitude,
      estimatedDeliveryTime || null
    ];
    
    // Execute the query
    const result = await this.databaseService.query<{ id: string }>(
      this.getInsertDeliveryQuery(),
      params
    );
    
    return result.rows[0].id;
  }
  
  /**
   * Get the SQL query for inserting a delivery
   */
  private getInsertDeliveryQuery(): string {
    return `INSERT INTO active_deliveries (
      id,
      order_id,
      driver_id,
      status,
      pickup_location,
      delivery_location,
      estimated_delivery_time
    ) VALUES (
      gen_random_uuid(),
      $1,
      $2,
      'assigned',
      ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
      ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
      $7
    ) RETURNING id`;
  }

  /**
   * Update the status of an active delivery
   */
  async updateDeliveryStatus(deliveryId: string, status: string): Promise<void> {
    try {
      await this.databaseService.query(
        `UPDATE active_deliveries
         SET status = $2, 
             ${status === 'completed' ? 'completed_at = NOW(),' : ''}
             updated_at = NOW()
         WHERE id = $1`,
        [deliveryId, status]
      );
    } catch (error) {
      this.logger.error(`Error updating delivery status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get active delivery details
   */
  async getActiveDeliveryDetails(deliveryId: string): Promise<ActiveDelivery | null> {
    try {
      return await this.fetchDeliveryById(deliveryId);
    } catch (error) {
      this.logger.error(`Error getting delivery details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Helper method to fetch delivery by ID
   */
  private async fetchDeliveryById(deliveryId: string): Promise<ActiveDelivery | null> {
    const result = await this.databaseService.query<ActiveDelivery>(
      this.getDeliverySelectQuery('id'),
      [deliveryId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  /**
   * Get the SQL query for selecting delivery details
   */
  private getDeliverySelectQuery(whereField: string): string {
    return `SELECT 
      id,
      order_id,
      driver_id,
      status,
      ST_X(pickup_location::geometry) AS pickup_longitude,
      ST_Y(pickup_location::geometry) AS pickup_latitude,
      ST_X(delivery_location::geometry) AS delivery_longitude,
      ST_Y(delivery_location::geometry) AS delivery_latitude,
      started_at,
      estimated_delivery_time,
      completed_at
     FROM active_deliveries
     WHERE ${whereField} = $1`;
  }

  /**
   * Get active delivery by order ID
   */
  async getActiveDeliveryByOrderId(orderId: string): Promise<ActiveDeliveryInterface | null> {
    try {
      return await this.fetchDeliveryByOrderId(orderId);
    } catch (error) {
      this.logger.error(`Error getting delivery by order ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Helper method to fetch delivery by order ID
   */
  private async fetchDeliveryByOrderId(orderId: string): Promise<ActiveDeliveryInterface | null> {
    const result = await this.databaseService.query<ActiveDelivery>(
      `${this.getDeliverySelectQuery('order_id')}
       ORDER BY started_at DESC
       LIMIT 1`,
      [orderId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const dbDelivery = result.rows[0];
    
    // Convert string dates to Date objects
    return {
      id: dbDelivery.id,
      order_id: dbDelivery.order_id,
      driver_id: dbDelivery.driver_id,
      status: dbDelivery.status,
      pickup_latitude: dbDelivery.pickup_latitude,
      pickup_longitude: dbDelivery.pickup_longitude,
      delivery_latitude: dbDelivery.delivery_latitude,
      delivery_longitude: dbDelivery.delivery_longitude,
      started_at: new Date(dbDelivery.started_at),
      estimated_delivery_time: dbDelivery.estimated_delivery_time ? new Date(dbDelivery.estimated_delivery_time) : undefined,
      completed_at: dbDelivery.completed_at ? new Date(dbDelivery.completed_at) : undefined
    };
  }
}
