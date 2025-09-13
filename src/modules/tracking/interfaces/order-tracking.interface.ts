/**
 * Interface for order tracking data
 */
export interface OrderTracking {
  orderId: string;
  deliveryId: string;
  status: string;
  driverId: string;
  pickup: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  currentLocation: {
    latitude: number;
    longitude: number;
    heading?: number;
    updatedAt: Date;
  };
  startedAt: Date;
  estimatedDeliveryTime?: Date;
  completedAt?: Date;
}
