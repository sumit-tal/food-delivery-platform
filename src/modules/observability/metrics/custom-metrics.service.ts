import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import * as client from 'prom-client';

/**
 * CustomMetricsService provides business-specific metrics collection.
 * It initializes metrics for business KPIs and provides methods to record them.
 */
@Injectable()
export class CustomMetricsService implements OnModuleInit {
  // Order metrics
  private orderProcessingTime!: client.Histogram<string>;
  private ordersTotal!: client.Counter<string>;
  private orderValueTotal!: client.Counter<string>;
  private activeOrders!: client.Gauge<string>;

  // Driver metrics
  private driversActive!: client.Gauge<string>;
  private driverDeliveryTime!: client.Histogram<string>;
  private driverDistanceTraveled!: client.Counter<string>;

  // Restaurant metrics
  private restaurantPreparationTime!: client.Histogram<string>;
  private restaurantOrdersTotal!: client.Counter<string>;

  // User metrics
  private userSessionDuration!: client.Histogram<string>;
  private userLoginTotal!: client.Counter<string>;
  private activeUsers!: client.Gauge<string>;

  public constructor(private readonly prometheusService: PrometheusService) {}

  /**
   * Initialize metrics when module starts.
   */
  public onModuleInit(): void {
    this.initOrderMetrics();
    this.initDriverMetrics();
    this.initRestaurantMetrics();
    this.initUserMetrics();
  }

  /**
   * Initialize order-related metrics.
   */
  private initOrderMetrics(): void {
    this.orderProcessingTime = this.prometheusService.createHistogram(
      'order_processing_time_seconds',
      'Time taken to process an order from creation to delivery',
      ['status'],
      [60, 300, 600, 900, 1800, 3600, 7200], // 1min, 5min, 10min, 15min, 30min, 1hr, 2hr
    );

    this.ordersTotal = this.prometheusService.createCounter(
      'orders_total',
      'Total number of orders',
      ['status', 'payment_method'],
    );

    this.orderValueTotal = this.prometheusService.createCounter(
      'order_value_total',
      'Total value of orders',
      ['payment_method'],
    );

    this.activeOrders = this.prometheusService.createGauge(
      'active_orders',
      'Number of currently active orders',
      ['status'],
    );
  }

  /**
   * Initialize driver-related metrics.
   */
  private initDriverMetrics(): void {
    this.driversActive = this.prometheusService.createGauge(
      'drivers_active',
      'Number of currently active drivers',
      ['region'],
    );

    this.driverDeliveryTime = this.prometheusService.createHistogram(
      'driver_delivery_time_seconds',
      'Time taken for a driver to deliver an order',
      ['region'],
      [300, 600, 900, 1200, 1800, 2400, 3600], // 5min, 10min, 15min, 20min, 30min, 40min, 1hr
    );

    this.driverDistanceTraveled = this.prometheusService.createCounter(
      'driver_distance_traveled_meters',
      'Total distance traveled by drivers in meters',
      ['driver_id'],
    );
  }

  /**
   * Initialize restaurant-related metrics.
   */
  private initRestaurantMetrics(): void {
    this.restaurantPreparationTime = this.prometheusService.createHistogram(
      'restaurant_preparation_time_seconds',
      'Time taken for a restaurant to prepare an order',
      ['restaurant_id', 'order_size'],
      [300, 600, 900, 1200, 1800], // 5min, 10min, 15min, 20min, 30min
    );

    this.restaurantOrdersTotal = this.prometheusService.createCounter(
      'restaurant_orders_total',
      'Total number of orders for a restaurant',
      ['restaurant_id'],
    );
  }

  /**
   * Initialize user-related metrics.
   */
  private initUserMetrics(): void {
    this.userSessionDuration = this.prometheusService.createHistogram(
      'user_session_duration_seconds',
      'Duration of user sessions',
      ['user_type'],
      [60, 300, 600, 1800, 3600, 7200], // 1min, 5min, 10min, 30min, 1hr, 2hr
    );

    this.userLoginTotal = this.prometheusService.createCounter(
      'user_login_total',
      'Total number of user logins',
      ['user_type', 'status'],
    );

    this.activeUsers = this.prometheusService.createGauge(
      'active_users',
      'Number of currently active users',
      ['user_type'],
    );
  }

  /**
   * Record order processing time.
   * @param status - Order status
   * @param durationSeconds - Processing time in seconds
   */
  public recordOrderProcessingTime(status: string, durationSeconds: number): void {
    this.orderProcessingTime.observe({ status }, durationSeconds);
  }

  /**
   * Increment the total number of orders.
   * @param status - Order status
   * @param paymentMethod - Payment method used
   */
  public incrementOrdersTotal(status: string, paymentMethod: string): void {
    this.ordersTotal.inc({ status, payment_method: paymentMethod });
  }

  /**
   * Increment the total value of orders.
   * @param paymentMethod - Payment method used
   * @param value - Order value
   */
  public incrementOrderValueTotal(paymentMethod: string, value: number): void {
    this.orderValueTotal.inc({ payment_method: paymentMethod }, value);
  }

  /**
   * Update the number of active orders.
   * @param status - Order status
   * @param count - Number of active orders
   */
  public updateActiveOrders(status: string, count: number): void {
    this.activeOrders.set({ status }, count);
  }

  /**
   * Update the number of active drivers.
   * @param region - Geographic region
   * @param count - Number of active drivers
   */
  public updateDriversActive(region: string, count: number): void {
    this.driversActive.set({ region }, count);
  }

  /**
   * Record driver delivery time.
   * @param region - Geographic region
   * @param durationSeconds - Delivery time in seconds
   */
  public recordDriverDeliveryTime(region: string, durationSeconds: number): void {
    this.driverDeliveryTime.observe({ region }, durationSeconds);
  }

  /**
   * Increment the total distance traveled by a driver.
   * @param driverId - Driver ID
   * @param distanceMeters - Distance in meters
   */
  public incrementDriverDistanceTraveled(driverId: string, distanceMeters: number): void {
    this.driverDistanceTraveled.inc({ driver_id: driverId }, distanceMeters);
  }

  /**
   * Record restaurant preparation time.
   * @param restaurantId - Restaurant ID
   * @param orderSize - Size category of the order
   * @param durationSeconds - Preparation time in seconds
   */
  public recordRestaurantPreparationTime(
    restaurantId: string,
    orderSize: string,
    durationSeconds: number,
  ): void {
    this.restaurantPreparationTime.observe(
      { restaurant_id: restaurantId, order_size: orderSize },
      durationSeconds,
    );
  }

  /**
   * Increment the total number of orders for a restaurant.
   * @param restaurantId - Restaurant ID
   */
  public incrementRestaurantOrdersTotal(restaurantId: string): void {
    this.restaurantOrdersTotal.inc({ restaurant_id: restaurantId });
  }

  /**
   * Record user session duration.
   * @param userType - User type (customer, driver, restaurant)
   * @param durationSeconds - Session duration in seconds
   */
  public recordUserSessionDuration(userType: string, durationSeconds: number): void {
    this.userSessionDuration.observe({ user_type: userType }, durationSeconds);
  }

  /**
   * Increment the total number of user logins.
   * @param userType - User type (customer, driver, restaurant)
   * @param status - Login status (success, failure)
   */
  public incrementUserLoginTotal(userType: string, status: string): void {
    this.userLoginTotal.inc({ user_type: userType, status });
  }

  /**
   * Update the number of active users.
   * @param userType - User type (customer, driver, restaurant)
   * @param count - Number of active users
   */
  public updateActiveUsers(userType: string, count: number): void {
    this.activeUsers.set({ user_type: userType }, count);
  }
}
