import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { NotificationService } from '../src/modules/notifications/services/notification.service';
import { NotificationQueueService } from '../src/modules/notifications/services/notification-queue.service';
import { NotificationPreferenceService } from '../src/modules/notifications/services/notification-preference.service';
import { EmailNotificationService } from '../src/modules/notifications/services/email-notification.service';
import { SmsNotificationService } from '../src/modules/notifications/services/sms-notification.service';
import { PushNotificationService } from '../src/modules/notifications/services/push-notification.service';
import { NotificationEntity } from '../src/modules/notifications/entities/notification.entity';
import { NotificationStatus, NotificationPriority, NotificationChannel } from '../src/modules/notifications/interfaces/notification.interface';

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: Repository<NotificationEntity>;
  let notificationQueueService: NotificationQueueService;
  let notificationPreferenceService: NotificationPreferenceService;
  let eventEmitter: EventEmitter2;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    })),
  };

  const mockNotificationQueueService = {
    addToQueue: jest.fn(),
  };

  const mockNotificationPreferenceService = {
    getUserPreferences: jest.fn(),
  };

  const mockEmailNotificationService = {
    send: jest.fn(),
  };

  const mockSmsNotificationService = {
    send: jest.fn(),
  };

  const mockPushNotificationService = {
    send: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: mockRepository,
        },
        {
          provide: NotificationQueueService,
          useValue: mockNotificationQueueService,
        },
        {
          provide: NotificationPreferenceService,
          useValue: mockNotificationPreferenceService,
        },
        {
          provide: EmailNotificationService,
          useValue: mockEmailNotificationService,
        },
        {
          provide: SmsNotificationService,
          useValue: mockSmsNotificationService,
        },
        {
          provide: PushNotificationService,
          useValue: mockPushNotificationService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repository = module.get<Repository<NotificationEntity>>(getRepositoryToken(NotificationEntity));
    notificationQueueService = module.get<NotificationQueueService>(NotificationQueueService);
    notificationPreferenceService = module.get<NotificationPreferenceService>(NotificationPreferenceService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotification', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const notificationData = {
      userId,
      title: 'Test Notification',
      content: 'This is a test notification',
      type: 'test',
    };

    const savedNotification = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      userId,
      title: 'Test Notification',
      content: 'This is a test notification',
      type: 'test',
      status: NotificationStatus.UNREAD,
      priority: NotificationPriority.NORMAL,
      channels: [NotificationChannel.IN_APP],
      metadata: {},
      isDelivered: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a notification with default values when no preferences exist', async () => {
      mockNotificationPreferenceService.getUserPreferences.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(savedNotification);
      mockRepository.save.mockResolvedValue(savedNotification);

      const result = await service.createNotification(notificationData);

      expect(mockNotificationPreferenceService.getUserPreferences).toHaveBeenCalledWith(userId, 'test');
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        title: 'Test Notification',
        content: 'This is a test notification',
        type: 'test',
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.IN_APP],
        metadata: {},
        status: NotificationStatus.UNREAD,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(savedNotification);
      expect(mockNotificationQueueService.addToQueue).toHaveBeenCalledWith(savedNotification);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('notification.created', savedNotification);
      expect(result).toEqual(savedNotification);
    });

    it('should create a notification with user preferences', async () => {
      const userPreferences = {
        userId,
        notificationType: 'test',
        channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
        enabled: true,
      };

      mockNotificationPreferenceService.getUserPreferences.mockResolvedValue(userPreferences);
      mockRepository.create.mockReturnValue({
        ...savedNotification,
        channels: userPreferences.channels,
      });
      mockRepository.save.mockResolvedValue({
        ...savedNotification,
        channels: userPreferences.channels,
      });

      const result = await service.createNotification(notificationData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        title: 'Test Notification',
        content: 'This is a test notification',
        type: 'test',
        priority: NotificationPriority.NORMAL,
        channels: userPreferences.channels,
        metadata: {},
        status: NotificationStatus.UNREAD,
      });
      expect(result.channels).toEqual(userPreferences.channels);
    });

    it('should not create a notification if user has disabled the notification type', async () => {
      const userPreferences = {
        userId,
        notificationType: 'test',
        channels: [NotificationChannel.EMAIL],
        enabled: false,
      };

      mockNotificationPreferenceService.getUserPreferences.mockResolvedValue(userPreferences);

      await expect(service.createNotification(notificationData)).rejects.toThrow(
        `Notifications of type test are disabled for user ${userId}`,
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockNotificationQueueService.addToQueue).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const notificationId = '123e4567-e89b-12d3-a456-426614174001';
    const notification = {
      id: notificationId,
      userId,
      status: NotificationStatus.UNREAD,
    };

    it('should mark a notification as read', async () => {
      mockRepository.findOne.mockResolvedValue(notification);
      mockRepository.save.mockImplementation((n) => Promise.resolve(n));

      const result = await service.markAsRead(notificationId, userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, userId },
      });
      expect(result.status).toBe(NotificationStatus.READ);
      expect(result.readAt).toBeDefined();
    });

    it('should throw an error if notification is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(notificationId, userId)).rejects.toThrow(
        `Notification not found: ${notificationId}`,
      );
    });
  });

  describe('getUnreadCount', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return the count of unread notifications', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(userId);

      expect(mockRepository.count).toHaveBeenCalledWith({
        where: {
          userId,
          status: NotificationStatus.UNREAD,
        },
      });
      expect(result).toBe(5);
    });
  });

  describe('getUserNotifications', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const notifications = [
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        userId,
        title: 'Test Notification 1',
        content: 'This is test notification 1',
        status: NotificationStatus.UNREAD,
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        userId,
        title: 'Test Notification 2',
        content: 'This is test notification 2',
        status: NotificationStatus.READ,
      },
    ];

    it('should return paginated notifications for a user', async () => {
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getManyAndCount.mockResolvedValue([notifications, 2]);

      const result = await service.getUserNotifications(userId);

      expect(queryBuilder.where).toHaveBeenCalledWith('notification.userId = :userId', { userId });
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('notification.createdAt', 'DESC');
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({ notifications, total: 2 });
    });

    it('should filter by status if provided', async () => {
      const queryBuilder = repository.createQueryBuilder();
      queryBuilder.getManyAndCount.mockResolvedValue([[notifications[0]], 1]);

      const result = await service.getUserNotifications(userId, NotificationStatus.UNREAD);

      expect(queryBuilder.where).toHaveBeenCalledWith('notification.userId = :userId', { userId });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('notification.status = :status', {
        status: NotificationStatus.UNREAD,
      });
      expect(result).toEqual({ notifications: [notifications[0]], total: 1 });
    });
  });
});
