import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { ProcessPaymentDto } from '../src/modules/payments/dto/process-payment.dto';
import { RefundPaymentDto } from '../src/modules/payments/dto/refund-payment.dto';
import { PaymentResponseDto } from '../src/modules/payments/dto/payment-response.dto';
import { PaymentEntity } from '../src/modules/payments/entities/payment.entity';
import {
  PaymentStatus,
  PaymentMethodType,
  PaymentResult,
} from '../src/modules/payments/interfaces/payment-gateway.interface';

describe('When PaymentsController is used', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockLogger = {
    error: jest.fn(),
  };

  const mockPaymentsService = {
    processPayment: jest.fn(),
    refundPayment: jest.fn(),
    getPaymentById: jest.fn(),
    getPaymentsByOrderId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When processPayment is called', () => {
    const mockProcessPaymentDto: ProcessPaymentDto = {
      orderId: 'order-123',
      amount: 1000,
      currency: 'USD',
      paymentMethod: {
        type: PaymentMethodType.CREDIT_CARD,
        cardNumber: '4111111111111111',
        expiryMonth: 12,
        expiryYear: 2025,
        cvv: '123',
      },
      customerId: 'customer-123',
      customerEmail: 'customer@example.com',
      metadata: { source: 'web' },
    };

    const mockPaymentResult: PaymentResult = {
      success: true,
      paymentId: 'pay-123',
      status: PaymentStatus.CAPTURED,
      timestamp: new Date(),
    };

    it('Then should process payment successfully and return payment response', async () => {
      // Given
      paymentsService.processPayment.mockResolvedValue(mockPaymentResult);

      // When
      const result = await controller.processPayment(mockProcessPaymentDto);

      // Then
      expect(paymentsService.processPayment).toHaveBeenCalledWith(
        mockProcessPaymentDto.orderId,
        mockProcessPaymentDto.amount,
        mockProcessPaymentDto.currency,
        mockProcessPaymentDto.paymentMethod,
        mockProcessPaymentDto.customerId,
        mockProcessPaymentDto.customerEmail,
        mockProcessPaymentDto.metadata,
      );
      expect(result).toMatchObject({
        id: 'pay-123',
        success: true,
        orderId: mockProcessPaymentDto.orderId,
        amount: mockProcessPaymentDto.amount,
        currency: mockProcessPaymentDto.currency,
        status: PaymentStatus.CAPTURED,
      });
    });

    it('Then should handle payment processing error and throw HttpException', async () => {
      // Given
      const error = new Error('Payment gateway error');
      paymentsService.processPayment.mockRejectedValue(error);

      // When & Then
      await expect(controller.processPayment(mockProcessPaymentDto)).rejects.toThrow(HttpException);
      await expect(controller.processPayment(mockProcessPaymentDto)).rejects.toThrow(
        'Error processing payment: Payment gateway error',
      );
    });

    it('Then should use paymentId as id when paymentId is available', async () => {
      // Given
      paymentsService.processPayment.mockResolvedValue(mockPaymentResult);

      // When
      const result = await controller.processPayment(mockProcessPaymentDto);

      // Then
      expect(result.id).toBe('pay-123');
    });

    it('Then should use unknown as id when paymentId is not available', async () => {
      // Given
      const resultWithoutPaymentId = { ...mockPaymentResult, paymentId: undefined };
      paymentsService.processPayment.mockResolvedValue(resultWithoutPaymentId);

      // When
      const result = await controller.processPayment(mockProcessPaymentDto);

      // Then
      expect(result.id).toBe('unknown');
    });
  });

  describe('When refundPayment is called', () => {
    const mockRefundPaymentDto: RefundPaymentDto = {
      paymentId: 'pay-123',
      amount: 500,
      reason: 'Customer request',
    };

    const mockRefundResult: PaymentResult = {
      success: true,
      status: PaymentStatus.REFUNDED,
      timestamp: new Date(),
    };

    const mockPaymentEntity: PaymentEntity = {
      id: 'pay-123',
      orderId: 'order-123',
      gatewayPaymentId: 'gw-pay-123',
      idempotencyKey: 'idemp-123',
      amount: 1000,
      currency: 'USD',
      status: PaymentStatus.CAPTURED,
      paymentMethod: { type: PaymentMethodType.CREDIT_CARD },
      refundedAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('Then should refund payment successfully and return refund response', async () => {
      // Given
      paymentsService.refundPayment.mockResolvedValue(mockRefundResult);
      paymentsService.getPaymentById.mockResolvedValue(mockPaymentEntity);

      // When
      const result = await controller.refundPayment(mockRefundPaymentDto);

      // Then
      expect(paymentsService.refundPayment).toHaveBeenCalledWith(
        mockRefundPaymentDto.paymentId,
        mockRefundPaymentDto.amount,
      );
      expect(paymentsService.getPaymentById).toHaveBeenCalledWith(mockRefundPaymentDto.paymentId);
      expect(result).toMatchObject({
        id: mockRefundPaymentDto.paymentId,
        success: true,
        orderId: mockPaymentEntity.orderId,
        amount: mockRefundPaymentDto.amount,
        currency: mockPaymentEntity.currency,
        status: PaymentStatus.REFUNDED,
      });
    });

    it('Then should use full payment amount when refund amount is not specified', async () => {
      // Given
      const dtoWithoutAmount = { ...mockRefundPaymentDto, amount: undefined };
      paymentsService.refundPayment.mockResolvedValue(mockRefundResult);
      paymentsService.getPaymentById.mockResolvedValue(mockPaymentEntity);

      // When
      const result = await controller.refundPayment(dtoWithoutAmount);

      // Then
      expect(result.amount).toBe(mockPaymentEntity.amount);
    });

    it('Then should throw HttpException when payment not found', async () => {
      // Given
      paymentsService.refundPayment.mockResolvedValue(mockRefundResult);
      paymentsService.getPaymentById.mockResolvedValue(null);

      // When & Then
      await expect(controller.refundPayment(mockRefundPaymentDto)).rejects.toThrow(HttpException);
      await expect(controller.refundPayment(mockRefundPaymentDto)).rejects.toThrow(
        'Payment not found',
      );
    });

    it('Then should handle refund processing error and throw HttpException', async () => {
      // Given
      const error = new Error('Refund failed');
      paymentsService.refundPayment.mockRejectedValue(error);

      // When & Then
      await expect(controller.refundPayment(mockRefundPaymentDto)).rejects.toThrow(HttpException);
      await expect(controller.refundPayment(mockRefundPaymentDto)).rejects.toThrow(
        'Error refunding payment: Refund failed',
      );
    });
  });

  describe('When getPayment is called', () => {
    const paymentId = 'pay-123';
    const mockPaymentEntity: PaymentEntity = {
      id: paymentId,
      orderId: 'order-123',
      gatewayPaymentId: 'gw-pay-123',
      idempotencyKey: 'idemp-123',
      amount: 1000,
      currency: 'USD',
      status: PaymentStatus.CAPTURED,
      paymentMethod: { type: PaymentMethodType.CREDIT_CARD },
      refundedAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('Then should return payment when found', async () => {
      // Given
      paymentsService.getPaymentById.mockResolvedValue(mockPaymentEntity);

      // When
      const result = await controller.getPayment(paymentId);

      // Then
      expect(paymentsService.getPaymentById).toHaveBeenCalledWith(paymentId);
      expect(result).toBe(mockPaymentEntity);
    });

    it('Then should throw HttpException when payment not found', async () => {
      // Given
      paymentsService.getPaymentById.mockResolvedValue(null);

      // When & Then
      await expect(controller.getPayment(paymentId)).rejects.toThrow(HttpException);
      await expect(controller.getPayment(paymentId)).rejects.toThrow('Payment not found');
    });

    it('Then should re-throw HttpException from service', async () => {
      // Given
      const httpException = new HttpException('Service error', HttpStatus.BAD_REQUEST);
      paymentsService.getPaymentById.mockRejectedValue(httpException);

      // When & Then
      await expect(controller.getPayment(paymentId)).rejects.toThrow(httpException);
    });

    it('Then should handle generic error and throw HttpException', async () => {
      // Given
      const error = new Error('Database error');
      paymentsService.getPaymentById.mockRejectedValue(error);

      // When & Then
      await expect(controller.getPayment(paymentId)).rejects.toThrow(HttpException);
      await expect(controller.getPayment(paymentId)).rejects.toThrow(
        'Error retrieving payment: Database error',
      );
    });
  });

  describe('When getPaymentsByOrder is called', () => {
    const orderId = 'order-123';
    const mockPayments: PaymentEntity[] = [
      {
        id: 'pay-1',
        orderId,
        gatewayPaymentId: 'gw-pay-1',
        idempotencyKey: 'idemp-1',
        amount: 500,
        currency: 'USD',
        status: PaymentStatus.CAPTURED,
        paymentMethod: { type: PaymentMethodType.CREDIT_CARD },
        refundedAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'pay-2',
        orderId,
        gatewayPaymentId: 'gw-pay-2',
        idempotencyKey: 'idemp-2',
        amount: 500,
        currency: 'USD',
        status: PaymentStatus.CAPTURED,
        paymentMethod: { type: PaymentMethodType.CREDIT_CARD },
        refundedAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('Then should return array of payments for the order', async () => {
      // Given
      paymentsService.getPaymentsByOrderId.mockResolvedValue(mockPayments);

      // When
      const result = await controller.getPaymentsByOrder(orderId);

      // Then
      expect(paymentsService.getPaymentsByOrderId).toHaveBeenCalledWith(orderId);
      expect(result).toBe(mockPayments);
      expect(result).toHaveLength(2);
    });

    it('Then should return empty array when no payments found', async () => {
      // Given
      paymentsService.getPaymentsByOrderId.mockResolvedValue([]);

      // When
      const result = await controller.getPaymentsByOrder(orderId);

      // Then
      expect(result).toEqual([]);
    });

    it('Then should handle error and throw HttpException', async () => {
      // Given
      const originalError = new Error('Database connection failed');
      paymentsService.getPaymentsByOrderId.mockRejectedValue(originalError);

      // When & Then
      await expect(controller.getPaymentsByOrder(orderId)).rejects.toThrow(HttpException);
      await expect(controller.getPaymentsByOrder(orderId)).rejects.toThrow(
        'Error retrieving order payments: Database connection failed',
      );
    });
  });
});
