import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PaymentEntity } from '../src/modules/payments/entities/payment.entity';
import { PaymentFailureQueueEntity } from '../src/modules/payments/entities/payment-failure-queue.entity';
import { CircuitBreakerService } from '../src/modules/payments/services/circuit-breaker.service';
import { PaymentRetryService } from '../src/modules/payments/services/payment-retry.service';
import { PaymentCacheService } from '../src/modules/payments/services/payment-cache.service';
import { IdempotencyService } from '../src/modules/orders/services/idempotency.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PaymentGateway, PaymentStatus } from '../src/modules/payments/interfaces/payment-gateway.interface';
import { MockPaymentGateway } from '../src/modules/payments/gateways/mock-payment.gateway';

// Mock repositories
const mockPaymentRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn()
});

// Mock services
const mockCircuitBreakerService = () => ({
  executeWithCircuitBreaker: jest.fn((circuitId, operation) => operation())
});

const mockPaymentRetryService = () => ({
  addToRetryQueue: jest.fn()
});

const mockPaymentCacheService = () => ({
  get: jest.fn(),
  set: jest.fn()
});

const mockIdempotencyService = () => ({
  executeWithIdempotency: jest.fn((key, payload, operation) => operation())
});

const mockOrdersService = () => ({
  getOrderById: jest.fn()
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentGateway: PaymentGateway;
  let paymentRepository: Repository<PaymentEntity>;
  let circuitBreakerService: CircuitBreakerService;
  let paymentCacheService: PaymentCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(PaymentEntity),
          useFactory: mockPaymentRepository
        },
        {
          provide: getRepositoryToken(PaymentFailureQueueEntity),
          useFactory: mockPaymentRepository
        },
        {
          provide: 'PaymentGateway',
          useClass: MockPaymentGateway
        },
        {
          provide: CircuitBreakerService,
          useFactory: mockCircuitBreakerService
        },
        {
          provide: PaymentRetryService,
          useFactory: mockPaymentRetryService
        },
        {
          provide: PaymentCacheService,
          useFactory: mockPaymentCacheService
        },
        {
          provide: IdempotencyService,
          useFactory: mockIdempotencyService
        },
        {
          provide: OrdersService,
          useFactory: mockOrdersService
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'PAYMENT_CACHE_TTL_MS') return 1800000; // 30 minutes
              return null;
            })
          }
        }
      ]
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentGateway = module.get<PaymentGateway>('PaymentGateway');
    paymentRepository = module.get<Repository<PaymentEntity>>(getRepositoryToken(PaymentEntity));
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
    paymentCacheService = module.get<PaymentCacheService>(PaymentCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processPayment', () => {
    it('should process a payment successfully', async () => {
      // Mock order service
      const mockOrder = { id: 'order-123', status: 'pending' };
      (service as any).ordersService.getOrderById.mockResolvedValue(mockOrder);

      // Mock payment gateway
      const mockPaymentResult = {
        success: true,
        paymentId: 'payment-123',
        status: PaymentStatus.CAPTURED,
        timestamp: new Date()
      };
      jest.spyOn(paymentGateway, 'authorizePayment').mockResolvedValue(mockPaymentResult);
      jest.spyOn(paymentGateway, 'capturePayment').mockResolvedValue({
        ...mockPaymentResult,
        status: PaymentStatus.CAPTURED
      });

      // Mock repository
      const mockPaymentEntity = {
        id: 'db-payment-123',
        orderId: 'order-123',
        gatewayPaymentId: 'payment-123',
        status: PaymentStatus.CAPTURED
      };
      (paymentRepository.create as jest.Mock).mockReturnValue(mockPaymentEntity);
      (paymentRepository.save as jest.Mock).mockResolvedValue(mockPaymentEntity);
      (paymentRepository.findOne as jest.Mock).mockResolvedValue(mockPaymentEntity);

      // Execute payment
      const result = await service.processPayment(
        'order-123',
        1000,
        'USD',
        { type: 'credit_card', cardNumber: '4111111111111111', expiryMonth: 12, expiryYear: 2025 },
        'customer-123',
        'customer@example.com'
      );

      // Verify results
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.id).toBe('db-payment-123');
      expect(circuitBreakerService.executeWithCircuitBreaker).toHaveBeenCalled();
      expect(paymentRepository.create).toHaveBeenCalled();
      expect(paymentRepository.save).toHaveBeenCalled();
    });

    it('should handle payment failure', async () => {
      // Mock order service
      const mockOrder = { id: 'order-123', status: 'pending' };
      (service as any).ordersService.getOrderById.mockResolvedValue(mockOrder);

      // Mock payment gateway failure
      const mockFailedPaymentResult = {
        success: false,
        paymentId: 'payment-123',
        status: PaymentStatus.FAILED,
        errorCode: 'card_declined',
        errorMessage: 'Card was declined',
        timestamp: new Date()
      };
      jest.spyOn(paymentGateway, 'authorizePayment').mockResolvedValue(mockFailedPaymentResult);

      // Mock repository
      const mockPaymentEntity = {
        id: 'db-payment-123',
        orderId: 'order-123',
        gatewayPaymentId: 'payment-123',
        status: PaymentStatus.FAILED,
        errorCode: 'card_declined',
        errorMessage: 'Card was declined'
      };
      (paymentRepository.create as jest.Mock).mockReturnValue(mockPaymentEntity);
      (paymentRepository.save as jest.Mock).mockResolvedValue(mockPaymentEntity);
      (paymentRepository.findOne as jest.Mock).mockResolvedValue(mockPaymentEntity);

      // Execute payment
      const result = await service.processPayment(
        'order-123',
        1000,
        'USD',
        { type: 'credit_card', cardNumber: '4111111111111111', expiryMonth: 12, expiryYear: 2025 },
        'customer-123',
        'customer@example.com'
      );

      // Verify results
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('card_declined');
      expect(result.id).toBe('db-payment-123');
    });

    it('should return cached result for duplicate payment requests', async () => {
      // Mock cache hit
      const cachedResult = {
        id: 'cached-payment-123',
        success: true,
        status: PaymentStatus.CAPTURED,
        timestamp: new Date()
      };
      (paymentCacheService.get as jest.Mock).mockReturnValue(cachedResult);

      // Execute payment
      const result = await service.processPayment(
        'order-123',
        1000,
        'USD',
        { type: 'credit_card', cardNumber: '4111111111111111', expiryMonth: 12, expiryYear: 2025 },
        'customer-123',
        'customer@example.com'
      );

      // Verify results
      expect(result).toBe(cachedResult);
      expect(paymentCacheService.get).toHaveBeenCalled();
      expect(paymentGateway.authorizePayment).not.toHaveBeenCalled();
    });
  });

  describe('refundPayment', () => {
    it('should refund a payment successfully', async () => {
      // Mock payment entity
      const mockPaymentEntity = {
        id: 'payment-123',
        orderId: 'order-123',
        gatewayPaymentId: 'gateway-payment-123',
        status: PaymentStatus.CAPTURED,
        amount: 1000,
        currency: 'USD'
      };
      (paymentRepository.findOne as jest.Mock).mockResolvedValue(mockPaymentEntity);

      // Mock refund result
      const mockRefundResult = {
        success: true,
        paymentId: 'gateway-payment-123',
        status: PaymentStatus.REFUNDED,
        timestamp: new Date()
      };
      jest.spyOn(paymentGateway, 'refundPayment').mockResolvedValue(mockRefundResult);

      // Execute refund
      const result = await service.refundPayment('payment-123');

      // Verify results
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(circuitBreakerService.executeWithCircuitBreaker).toHaveBeenCalled();
      expect(paymentRepository.update).toHaveBeenCalled();
    });
  });
});
