import { Test, type TestingModule } from '@nestjs/testing';
import { NotificationController } from 'src/modules/notifications/controllers/notification.controller';
import { NotificationService } from 'src/modules/notifications/services/notification.service';
import { NotificationPreferenceService } from 'src/modules/notifications/services/notification-preference.service';
import { NotificationTemplateService } from 'src/modules/notifications/services/notification-template.service';
import type { CreateNotificationDto } from 'src/modules/notifications/dto/create-notification.dto';
import type {
  UpdateNotificationPreferenceDto,
  GetNotificationPreferenceDto,
} from 'src/modules/notifications/dto/notification-preference.dto';
import type {
  CreateNotificationTemplateDto,
  SendTemplatedNotificationDto,
} from 'src/modules/notifications/dto/notification-template.dto';
import {
  NotificationStatus,
  NotificationPriority,
  NotificationChannel,
} from 'src/modules/notifications/interfaces/notification.interface';
import type { NotificationEntity } from 'src/modules/notifications/entities/notification.entity';
import type { NotificationPreferenceEntity } from 'src/modules/notifications/entities/notification-preference.entity';
import type { NotificationTemplateEntity } from 'src/modules/notifications/entities/notification-template.entity';

/**
 * Mock interfaces for the services used in NotificationController
 */
interface NotificationServiceMock {
  readonly createNotification: jest.MockedFunction<NotificationService['createNotification']>;
  readonly getUserNotifications: jest.MockedFunction<NotificationService['getUserNotifications']>;
  readonly getUnreadCount: jest.MockedFunction<NotificationService['getUnreadCount']>;
  readonly markAsRead: jest.MockedFunction<NotificationService['markAsRead']>;
  readonly markAllAsRead: jest.MockedFunction<NotificationService['markAllAsRead']>;
  readonly deleteNotification: jest.MockedFunction<NotificationService['deleteNotification']>;
}

interface NotificationPreferenceServiceMock {
  readonly getUserPreferences: jest.MockedFunction<
    NotificationPreferenceService['getUserPreferences']
  >;
  readonly getAllUserPreferences: jest.MockedFunction<
    NotificationPreferenceService['getAllUserPreferences']
  >;
  readonly updateUserPreferences: jest.MockedFunction<
    NotificationPreferenceService['updateUserPreferences']
  >;
  readonly setDefaultPreferences: jest.MockedFunction<
    NotificationPreferenceService['setDefaultPreferences']
  >;
}

interface NotificationTemplateServiceMock {
  readonly createTemplate: jest.MockedFunction<NotificationTemplateService['createTemplate']>;
  readonly updateTemplate: jest.MockedFunction<NotificationTemplateService['updateTemplate']>;
  readonly getTemplate: jest.MockedFunction<NotificationTemplateService['getTemplate']>;
  readonly deleteTemplate: jest.MockedFunction<NotificationTemplateService['deleteTemplate']>;
  readonly renderTemplate: jest.MockedFunction<NotificationTemplateService['renderTemplate']>;
}

/**
 * Helper functions to build test DTOs and entities
 */
const buildCreateNotificationDto = (): CreateNotificationDto => ({
  userId: 'user-123',
  title: 'Test Notification',
  content: 'This is a test notification',
  type: 'test_notification',
  priority: NotificationPriority.NORMAL,
  channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  metadata: { orderId: 'order-456' },
});

const buildNotificationEntity = (
  overrides: Partial<NotificationEntity> = {},
): NotificationEntity => ({
  id: 'notif-123',
  userId: 'user-123',
  title: 'Test Notification',
  content: 'This is a test notification',
  type: 'test_notification',
  status: NotificationStatus.UNREAD,
  priority: NotificationPriority.NORMAL,
  channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  metadata: { orderId: 'order-456' },
  isDelivered: false,
  retryCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildNotificationPreferenceEntity = (
  overrides: Partial<NotificationPreferenceEntity> = {},
): NotificationPreferenceEntity => ({
  id: 'pref-123',
  userId: 'user-123',
  notificationType: 'order_created',
  channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildNotificationTemplateEntity = (
  overrides: Partial<NotificationTemplateEntity> = {},
): NotificationTemplateEntity => ({
  id: 'template-123',
  templateKey: 'order_confirmation',
  title: 'Order Confirmed',
  content: 'Your order #{{orderId}} has been confirmed',
  metadata: { category: 'order' },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildUpdatePreferenceDto = (): UpdateNotificationPreferenceDto => ({
  userId: 'user-123',
  notificationType: 'order_created',
  channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
  enabled: true,
});

const buildGetPreferenceDto = (): GetNotificationPreferenceDto => ({
  userId: 'user-123',
  notificationType: 'order_created',
});

const buildCreateTemplateDto = (): CreateNotificationTemplateDto => ({
  templateKey: 'order_confirmation',
  title: 'Order Confirmed',
  content: 'Your order #{{orderId}} has been confirmed',
  metadata: { category: 'order', priority: NotificationPriority.HIGH },
});

const buildSendTemplatedDto = (): SendTemplatedNotificationDto => ({
  templateKey: 'order_confirmation',
  userId: 'user-123',
  data: { orderId: 'order-456', restaurantName: 'Tasty Bites' },
});

const createMockServices = (): {
  notificationService: NotificationServiceMock;
  preferenceService: NotificationPreferenceServiceMock;
  templateService: NotificationTemplateServiceMock;
} => ({
  notificationService: {
    createNotification: jest.fn(),
    getUserNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  } as NotificationServiceMock,
  preferenceService: {
    getUserPreferences: jest.fn(),
    getAllUserPreferences: jest.fn(),
    updateUserPreferences: jest.fn(),
    setDefaultPreferences: jest.fn(),
  } as NotificationPreferenceServiceMock,
  templateService: {
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    getTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    renderTemplate: jest.fn(),
  } as NotificationTemplateServiceMock,
});

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: NotificationServiceMock;
  let preferenceService: NotificationPreferenceServiceMock;
  let templateService: NotificationTemplateServiceMock;

  beforeEach(async () => {
    const mocks = createMockServices();
    notificationService = mocks.notificationService;
    preferenceService = mocks.preferenceService;
    templateService = mocks.templateService;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: NotificationPreferenceService, useValue: preferenceService },
        { provide: NotificationTemplateService, useValue: templateService },
      ],
    }).compile();

    controller = moduleRef.get<NotificationController>(NotificationController);
  });

  describe('createNotification', () => {
    it('When createNotification is called Then it forwards DTO to service and returns the result', async () => {
      // Arrange
      const dto = buildCreateNotificationDto();
      const expectedResult = buildNotificationEntity({
        ...dto,
        status: NotificationStatus.UNREAD,
      });
      notificationService.createNotification.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.createNotification(dto);

      // Assert
      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.createNotification).toHaveBeenCalledWith(dto);
      expect(result).toBe(expectedResult);
    });
  });

  describe('getUserNotifications', () => {
    it('When getUserNotifications is called without optional params Then it calls service with defaults', async () => {
      const userId = 'user-123';
      const expectedResult = {
        notifications: [buildNotificationEntity({ userId })],
        total: 1,
      };
      notificationService.getUserNotifications.mockResolvedValue(expectedResult);

      const result = await controller.getUserNotifications(userId);

      expect(notificationService.getUserNotifications).toHaveBeenCalledTimes(1);
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(userId, undefined, 1, 10);
      expect(result).toBe(expectedResult);
    });

    it('When getUserNotifications is called with status and pagination Then it forwards params to service', async () => {
      const userId = 'user-123';
      const status = NotificationStatus.READ;
      const page = 2;
      const limit = 5;
      const expectedResult = {
        notifications: [buildNotificationEntity({ id: 'notif-456', userId, status })],
        total: 1,
      };
      notificationService.getUserNotifications.mockResolvedValue(expectedResult);

      const result = await controller.getUserNotifications(userId, status, page, limit);

      expect(notificationService.getUserNotifications).toHaveBeenCalledTimes(1);
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(userId, status, page, limit);
      expect(result).toBe(expectedResult);
    });
  });

  describe('getUnreadCount', () => {
    it('When getUnreadCount is called Then it returns the count from service', async () => {
      // Arrange
      const userId = 'user-123';
      const unreadCount = 5;
      notificationService.getUnreadCount.mockResolvedValue(unreadCount);

      // Act
      const result = await controller.getUnreadCount(userId);

      // Assert
      expect(notificationService.getUnreadCount).toHaveBeenCalledTimes(1);
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ count: unreadCount });
    });
  });

  describe('markAsRead', () => {
    it('When markAsRead is called Then it forwards params to service and returns the result', async () => {
      // Arrange
      const notificationId = 'notif-123';
      const userId = 'user-123';
      const expectedResult = buildNotificationEntity({
        id: notificationId,
        userId,
        status: NotificationStatus.READ,
      });
      notificationService.markAsRead.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.markAsRead(notificationId, userId);

      // Assert
      expect(notificationService.markAsRead).toHaveBeenCalledTimes(1);
      expect(notificationService.markAsRead).toHaveBeenCalledWith(notificationId, userId);
      expect(result).toBe(expectedResult);
    });
  });

  describe('markAllAsRead', () => {
    it('When markAllAsRead is called Then it forwards userId to service and returns count', async () => {
      // Arrange
      const userId = 'user-123';
      const updatedCount = 3;
      notificationService.markAllAsRead.mockResolvedValue(updatedCount);

      // Act
      const result = await controller.markAllAsRead(userId);

      // Assert
      expect(notificationService.markAllAsRead).toHaveBeenCalledTimes(1);
      expect(notificationService.markAllAsRead).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ count: updatedCount });
    });
  });

  describe('deleteNotification', () => {
    it('When deleteNotification is called Then it forwards params to service', async () => {
      // Arrange
      const notificationId = 'notif-123';
      const userId = 'user-123';
      notificationService.deleteNotification.mockResolvedValue(true);

      // Act
      await controller.deleteNotification(notificationId, userId);

      // Assert
      expect(notificationService.deleteNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.deleteNotification).toHaveBeenCalledWith(notificationId, userId);
    });
  });

  describe('getUserPreferences', () => {
    it('When getUserPreferences is called with notificationType Then it calls specific service method', async () => {
      const dto = buildGetPreferenceDto();
      const expectedResult = buildNotificationPreferenceEntity({
        userId: dto.userId,
        notificationType: dto.notificationType!,
      });
      preferenceService.getUserPreferences.mockResolvedValue(expectedResult);

      const result = await controller.getUserPreferences(dto);

      expect(preferenceService.getUserPreferences).toHaveBeenCalledTimes(1);
      expect(preferenceService.getUserPreferences).toHaveBeenCalledWith(dto.userId, dto.notificationType);
      expect(result).toBe(expectedResult);
    });

    it('When getUserPreferences is called without notificationType Then it calls getAllUserPreferences', async () => {
      const dto = { userId: 'user-123' };
      const expectedResult = [
        buildNotificationPreferenceEntity({ userId: dto.userId, notificationType: 'order_created' }),
        buildNotificationPreferenceEntity({ id: 'pref-456', userId: dto.userId, notificationType: 'order_delivered' }),
      ];
      preferenceService.getAllUserPreferences.mockResolvedValue(expectedResult);

      const result = await controller.getUserPreferences(dto);

      expect(preferenceService.getAllUserPreferences).toHaveBeenCalledTimes(1);
      expect(preferenceService.getAllUserPreferences).toHaveBeenCalledWith(dto.userId);
      expect(result).toBe(expectedResult);
    });
  });

  describe('updateUserPreferences', () => {
    it('When updateUserPreferences is called Then it forwards DTO params to service', async () => {
      const dto = buildUpdatePreferenceDto();
      const expectedResult = buildNotificationPreferenceEntity(dto);
      preferenceService.updateUserPreferences.mockResolvedValue(expectedResult);

      const result = await controller.updateUserPreferences(dto);

      expect(preferenceService.updateUserPreferences).toHaveBeenCalledTimes(1);
      expect(preferenceService.updateUserPreferences).toHaveBeenCalledWith(
        dto.userId,
        dto.notificationType,
        dto.channels,
        dto.enabled,
      );
      expect(result).toBe(expectedResult);
    });
  });

  describe('setDefaultPreferences', () => {
    it('When setDefaultPreferences is called Then it forwards userId to service', async () => {
      const userId = 'user-123';
      const expectedResult = [
        buildNotificationPreferenceEntity({ userId, notificationType: 'order_created' }),
        buildNotificationPreferenceEntity({ id: 'pref-456', userId, notificationType: 'order_delivered' }),
      ];
      preferenceService.setDefaultPreferences.mockResolvedValue(expectedResult);

      const result = await controller.setDefaultPreferences(userId);

      expect(preferenceService.setDefaultPreferences).toHaveBeenCalledTimes(1);
      expect(preferenceService.setDefaultPreferences).toHaveBeenCalledWith(userId);
      expect(result).toBe(expectedResult);
    });
  });

  describe('createTemplate', () => {
    it('When createTemplate is called Then it forwards DTO fields to service', async () => {
      const dto = buildCreateTemplateDto();
      const expectedResult = buildNotificationTemplateEntity(dto);
      templateService.createTemplate.mockResolvedValue(expectedResult);

      const result = await controller.createTemplate(dto);

      expect(templateService.createTemplate).toHaveBeenCalledTimes(1);
      expect(templateService.createTemplate).toHaveBeenCalledWith(
        dto.templateKey,
        dto.title,
        dto.content,
        dto.metadata,
      );
      expect(result).toBe(expectedResult);
    });
  });

  describe('updateTemplate', () => {
    it('When updateTemplate is called Then it forwards templateKey and DTO fields to service', async () => {
      const templateKey = 'order_confirmation';
      const dto = buildCreateTemplateDto();
      const expectedResult = buildNotificationTemplateEntity({ ...dto, templateKey });
      templateService.updateTemplate.mockResolvedValue(expectedResult);

      const result = await controller.updateTemplate(templateKey, dto);

      expect(templateService.updateTemplate).toHaveBeenCalledTimes(1);
      expect(templateService.updateTemplate).toHaveBeenCalledWith(
        templateKey,
        dto.title,
        dto.content,
        dto.metadata,
      );
      expect(result).toBe(expectedResult);
    });
  });

  describe('getTemplate', () => {
    it('When getTemplate is called Then it forwards templateKey to service', async () => {
      // Arrange
      const templateKey = 'order_confirmation';
      const expectedResult = buildNotificationTemplateEntity({
        templateKey,
        title: 'Order Confirmed',
        content: 'Your order #{{orderId}} has been confirmed',
        metadata: { category: 'order' },
      });
      templateService.getTemplate.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.getTemplate(templateKey);

      // Assert
      expect(templateService.getTemplate).toHaveBeenCalledTimes(1);
      expect(templateService.getTemplate).toHaveBeenCalledWith(templateKey);
      expect(result).toBe(expectedResult);
    });
  });

  describe('deleteTemplate', () => {
    it('When deleteTemplate is called Then it forwards templateKey to service', async () => {
      // Arrange
      const templateKey = 'order_confirmation';
      templateService.deleteTemplate.mockResolvedValue(true);

      // Act
      await controller.deleteTemplate(templateKey);

      // Assert
      expect(templateService.deleteTemplate).toHaveBeenCalledTimes(1);
      expect(templateService.deleteTemplate).toHaveBeenCalledWith(templateKey);
    });
  });

  describe('sendTemplatedNotification', () => {
    it('When sendTemplatedNotification is called Then it renders template and creates notification', async () => {
      const dto = buildSendTemplatedDto();
      const renderedTemplate = {
        userId: dto.userId,
        title: 'Order Confirmed',
        content: 'Your order #order-456 has been confirmed',
        type: 'order_confirmation',
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        metadata: { orderId: 'order-456', restaurantName: 'Tasty Bites' },
      };
      const expectedResult = buildNotificationEntity({ id: 'notif-789', ...renderedTemplate });
      
      templateService.renderTemplate.mockResolvedValue(renderedTemplate);
      notificationService.createNotification.mockResolvedValue(expectedResult);

      const result = await controller.sendTemplatedNotification(dto);

      expect(templateService.renderTemplate).toHaveBeenCalledTimes(1);
      expect(templateService.renderTemplate).toHaveBeenCalledWith(dto.templateKey, dto.userId, dto.data);
      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.createNotification).toHaveBeenCalledWith(renderedTemplate);
      expect(result).toBe(expectedResult);
    });
  });
});
