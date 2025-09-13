/**
 * Interface for active delivery data
 */
export interface ActiveDelivery {
  id: string;
  order_id: string;
  driver_id: string;
  status: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  started_at: Date;
  estimated_delivery_time?: Date;
  completed_at?: Date;
}
