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
import { OnEvent } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NotificationEntity } from '../entities/notification.entity';
import { NotificationService } from '../services/notification.service';

/**
 * WebSocket gateway for real-time notifications
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'notifications',
})
export class NotificationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(NotificationGateway.name);
  private readonly userSocketMap: Map<string, Set<string>> = new Map();

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Initialize the WebSocket server
   */
  afterInit(): void {
    this.logger.log('Notification Gateway initialized');
  }

  /**
   * Handle new client connections
   */
  handleConnection(client: Socket): void {
    try {
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
      this.logger.debug(`Client disconnected: ${client.id}`);
      
      // Remove client from user socket map
      this.removeClientFromUserMap(client.id);
    } catch (error) {
      this.logger.error(`Error handling disconnection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle user authentication and subscription
   */
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('subscribe')
  handleSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ): void {
    try {
      const { userId } = data;
      
      // Add client to user's room
      void client.join(`user:${userId}`);
      
      // Add client to user socket map
      this.addClientToUserMap(userId, client.id);
      
      this.logger.debug(`Client ${client.id} subscribed to notifications for user ${userId}`);
      
      // Send acknowledgment
      client.emit('subscription-ack', { 
        timestamp: new Date().toISOString(),
        userId,
        status: 'subscribed'
      });
      
      // Send unread count
      this.sendUnreadCount(userId);
    } catch (error) {
      this.logger.error(`Error handling subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
      client.emit('subscription-ack', { 
        timestamp: new Date().toISOString(),
        status: 'error',
        message: 'Failed to subscribe to notifications'
      });
    }
  }

  /**
   * Handle notification read status update
   */
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('mark-as-read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; notificationId: string },
  ): Promise<void> {
    try {
      const { userId, notificationId } = data;
      
      // Mark notification as read
      await this.notificationService.markAsRead(notificationId, userId);
      
      // Send updated unread count
      this.sendUnreadCount(userId);
      
      // Send acknowledgment
      client.emit('mark-as-read-ack', { 
        timestamp: new Date().toISOString(),
        notificationId,
        status: 'success'
      });
    } catch (error) {
      this.logger.error(`Error marking notification as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
      client.emit('mark-as-read-ack', { 
        timestamp: new Date().toISOString(),
        status: 'error',
        message: 'Failed to mark notification as read'
      });
    }
  }

  /**
   * Handle marking all notifications as read
   */
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('mark-all-as-read')
  async handleMarkAllAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ): Promise<void> {
    try {
      const { userId } = data;
      
      // Mark all notifications as read
      const count = await this.notificationService.markAllAsRead(userId);
      
      // Send updated unread count (should be 0)
      this.sendUnreadCount(userId);
      
      // Send acknowledgment
      client.emit('mark-all-as-read-ack', { 
        timestamp: new Date().toISOString(),
        count,
        status: 'success'
      });
    } catch (error) {
      this.logger.error(`Error marking all notifications as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
      client.emit('mark-all-as-read-ack', { 
        timestamp: new Date().toISOString(),
        status: 'error',
        message: 'Failed to mark all notifications as read'
      });
    }
  }

  /**
   * Listen for notification created events
   */
  @OnEvent('notification.created')
  handleNotificationCreated(notification: NotificationEntity): void {
    try {
      this.logger.debug(`Broadcasting notification ${notification.id} to user ${notification.userId}`);
      
      // Broadcast notification to user's room
      this.server.to(`user:${notification.userId}`).emit('notification', {
        id: notification.id,
        title: notification.title,
        content: notification.content,
        type: notification.type,
        createdAt: notification.createdAt,
        metadata: notification.metadata,
      });
      
      // Send updated unread count
      this.sendUnreadCount(notification.userId);
    } catch (error) {
      this.logger.error(`Error broadcasting notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send unread notification count to user
   */
  private async sendUnreadCount(userId: string): Promise<void> {
    try {
      const count = await this.notificationService.getUnreadCount(userId);
      
      this.server.to(`user:${userId}`).emit('unread-count', { count });
    } catch (error) {
      this.logger.error(`Error sending unread count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add client to user socket map
   */
  private addClientToUserMap(userId: string, socketId: string): void {
    if (!this.userSocketMap.has(userId)) {
      this.userSocketMap.set(userId, new Set());
    }
    
    this.userSocketMap.get(userId)?.add(socketId);
  }

  /**
   * Remove client from user socket map
   */
  private removeClientFromUserMap(socketId: string): void {
    for (const [userId, socketIds] of this.userSocketMap.entries()) {
      if (socketIds.has(socketId)) {
        socketIds.delete(socketId);
        
        if (socketIds.size === 0) {
          this.userSocketMap.delete(userId);
        }
        
        break;
      }
    }
  }
}
