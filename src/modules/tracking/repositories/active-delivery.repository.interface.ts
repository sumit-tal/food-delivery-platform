import type { ActiveDelivery } from '../interfaces';

/**
 * Interface for active delivery repository
 */
export interface IActiveDeliveryRepository {
  /**
   * Get active delivery by order ID
   */
  getActiveDeliveryByOrderId(orderId: string): Promise<ActiveDelivery | null>;
  
  /**
   * Create a new active delivery
   */
  createActiveDelivery(
    orderId: string,
    driverId: string,
    pickupLatitude: number,
    pickupLongitude: number,
    deliveryLatitude: number,
    deliveryLongitude: number,
    estimatedDeliveryTime?: Date
  ): Promise<string>;
  
  /**
   * Update the status of an active delivery
   */
  updateDeliveryStatus(deliveryId: string, status: string): Promise<void>;
}
