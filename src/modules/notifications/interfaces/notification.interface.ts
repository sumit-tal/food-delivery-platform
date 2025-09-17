/**
 * Enum representing notification status
 */
export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

/**
 * Enum representing notification priority
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Enum representing notification channels
 */
export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

/**
 * Enum representing notification types
 */
export enum NotificationType {
  ORDER_CREATED = 'order_created',
  ORDER_CONFIRMED = 'order_confirmed',
  ORDER_PREPARED = 'order_prepared',
  ORDER_PICKED_UP = 'order_picked_up',
  ORDER_DELIVERED = 'order_delivered',
  ORDER_CANCELLED = 'order_cancelled',
  DRIVER_ASSIGNED = 'driver_assigned',
  DRIVER_ARRIVED = 'driver_arrived',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  RESTAURANT_NEARBY = 'restaurant_nearby',
  SPECIAL_OFFER = 'special_offer',
  ACCOUNT_UPDATE = 'account_update',
}

/**
 * Interface for notification data
 */
export interface NotificationData {
  userId: string;
  title: string;
  content: string;
  type: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
}

/**
 * Interface for notification template data
 */
export interface NotificationTemplateData {
  templateKey: string;
  data: Record<string, any>;
}

/**
 * Interface for notification delivery result
 */
export interface NotificationDeliveryResult {
  success: boolean;
  channel: NotificationChannel;
  error?: string;
  timestamp: Date;
}

/**
 * Interface for notification delivery options
 */
export interface NotificationDeliveryOptions {
  retry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  priority?: NotificationPriority;
}

/**
 * Interface for notification provider configuration
 */
export interface NotificationProviderConfig {
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  from?: string;
  options?: Record<string, any>;
}
