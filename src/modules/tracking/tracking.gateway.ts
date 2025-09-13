import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocationProcessingService, ConnectionManagerService } from './services';
import { LocationUpdateDto, TrackingSubscriptionDto } from './dto';

/**
 * WebSocket gateway for real-time driver tracking
 * Handles location updates from drivers and tracking subscriptions from customers
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'tracking',
})
export class TrackingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(TrackingGateway.name);
  private readonly maxConnections: number;

  constructor(
    private readonly locationProcessingService: LocationProcessingService,
    private readonly connectionManager: ConnectionManagerService,
    private readonly configService: ConfigService,
  ) {
    this.maxConnections = this.configService.get<number>('MAX_CONCURRENT_CONNECTIONS', 10000);
  }

  /**
   * Initialize the WebSocket server
   */
  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');
  }

  /**
   * Handle new client connections
   */
  handleConnection(client: Socket): void {
    try {
      // Check if we've reached the maximum number of connections
      if (this.connectionManager.getConnectionCount() >= this.maxConnections) {
        this.logger.warn(`Connection limit reached (${this.maxConnections}). Rejecting new connection.`);
        client.disconnect(true);
        return;
      }

      // Register the new connection
      this.connectionManager.registerConnection(client.id);
      this.logger.debug(`Client connected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Error handling connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      client.disconnect(true);
    }
  }

  /**
   * Handle client disconnections
   */
  handleDisconnect(client: Socket): void {
    try {
      // Unregister the connection
      this.connectionManager.unregisterConnection(client.id);
      this.logger.debug(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Error handling disconnection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle location updates from drivers
   */
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('location-update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() locationUpdate: LocationUpdateDto,
  ): Promise<void> {
    try {
      // Process the location update
      await this.locationProcessingService.processLocationUpdate(locationUpdate);
      
      // Acknowledge receipt of the update
      client.emit('location-update-ack', { 
        timestamp: new Date().toISOString(),
        status: 'received'
      });
    } catch (error) {
      this.logger.error(`Error processing location update: ${error instanceof Error ? error.message : 'Unknown error'}`);
      client.emit('location-update-ack', { 
        timestamp: new Date().toISOString(),
        status: 'error',
        message: 'Failed to process location update'
      });
    }
  }

  /**
   * Handle tracking subscriptions from customers
   */
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('subscribe-to-tracking')
  handleTrackingSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() subscription: TrackingSubscriptionDto,
  ): void {
    try {
      // Register the tracking subscription
      const orderId = subscription.orderId;
      
      // Add the client to the order-specific room
      void client.join(`order:${orderId}`);
      
      this.logger.debug(`Client ${client.id} subscribed to tracking for order ${orderId}`);
      
      // Send acknowledgment
      client.emit('subscription-ack', { 
        timestamp: new Date().toISOString(),
        orderId,
        status: 'subscribed'
      });
    } catch (error) {
      this.logger.error(`Error handling tracking subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
      client.emit('subscription-ack', { 
        timestamp: new Date().toISOString(),
        orderId: subscription.orderId,
        status: 'error',
        message: 'Failed to subscribe to tracking'
      });
    }
  }

  /**
   * Broadcast driver location to all subscribed clients for a specific order
   */
  broadcastDriverLocation(orderId: string, locationData: { latitude: number; longitude: number; heading?: number; timestamp: string }): void {
    this.server.to(`order:${orderId}`).emit('driver-location-update', locationData);
  }
}
