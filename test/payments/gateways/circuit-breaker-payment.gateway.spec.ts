import { CircuitBreakerPaymentGateway } from '../../../src/modules/payments/gateways/circuit-breaker-payment.gateway';
import {
  PaymentGateway,
  PaymentDetails,
  PaymentResult,
  PaymentStatus,
  PaymentMethodType,
} from '../../../src/modules/payments/interfaces/payment-gateway.interface';
import { CircuitBreakerService } from '../../../src/modules/payments/services/circuit-breaker.service';

/**
 * Tests for CircuitBreakerPaymentGateway
 */
describe('CircuitBreakerPaymentGateway', () => {
  let gateway: CircuitBreakerPaymentGateway;
  let paymentGatewayMock: jest.Mocked<PaymentGateway>;
  let circuitBreakerMock: jest.Mocked<CircuitBreakerService>;

  const paymentDetails: PaymentDetails = {
    orderId: 'order-123',
    amount: 1999,
    currency: 'USD',
    paymentMethod: { type: PaymentMethodType.CREDIT_CARD, details: {} },
    customer: { id: 'cust-1', email: 'a@b.com' },
    idempotencyKey: 'idem-1',
  };

  const successResult: PaymentResult = {
    success: true,
    paymentId: 'pay_123',
    status: PaymentStatus.AUTHORIZED,
    timestamp: new Date(),
    gatewayResponse: { ok: true },
  };

  beforeEach(() => {
    paymentGatewayMock = {
      authorizePayment: jest.fn().mockResolvedValue(successResult),
      capturePayment: jest
        .fn()
        .mockResolvedValue({ ...successResult, status: PaymentStatus.CAPTURED }),
      refundPayment: jest
        .fn()
        .mockResolvedValue({ ...successResult, status: PaymentStatus.REFUNDED }),
      voidPayment: jest.fn().mockResolvedValue({ ...successResult, status: PaymentStatus.VOIDED }),
      getPaymentStatus: jest
        .fn()
        .mockResolvedValue({ ...successResult, status: PaymentStatus.PENDING }),
    };

    circuitBreakerMock = {
      executeWithCircuitBreaker: jest.fn(async (_id, operation, _config) => operation()),
      getCircuitState: jest.fn(),
      resetCircuit: jest.fn(),
    } as unknown as jest.Mocked<CircuitBreakerService>;

    gateway = new CircuitBreakerPaymentGateway(paymentGatewayMock, circuitBreakerMock);
  });

  it('authorizePayment should call circuit breaker with proper ID and delegate operation', async () => {
    await gateway.authorizePayment(paymentDetails);
    expect(circuitBreakerMock.executeWithCircuitBreaker).toHaveBeenCalledTimes(1);
    const [circuitId, operation, config] =
      circuitBreakerMock.executeWithCircuitBreaker.mock.calls[0];
    expect(circuitId).toBe(`payment-authorize-${paymentDetails.orderId}`);
    expect(typeof operation).toBe('function');
    expect(config && typeof (config as any).fallback).toBe('function');
    await operation();
    expect(paymentGatewayMock.authorizePayment).toHaveBeenCalledWith(paymentDetails);
  });

  it('capturePayment should call circuit breaker with proper ID and delegate operation', async () => {
    await gateway.capturePayment('pay_1', 500);
    expect(circuitBreakerMock.executeWithCircuitBreaker).toHaveBeenCalledTimes(1);
    const [circuitId, operation, config] =
      circuitBreakerMock.executeWithCircuitBreaker.mock.calls[0];
    expect(circuitId).toBe('payment-capture-pay_1');
    expect(typeof operation).toBe('function');
    expect(config && typeof (config as any).fallback).toBe('function');
    await operation();
    expect(paymentGatewayMock.capturePayment).toHaveBeenCalledWith('pay_1', 500);
  });

  it('refundPayment should call circuit breaker with proper ID and delegate operation', async () => {
    await gateway.refundPayment('pay_2', 700);
    expect(circuitBreakerMock.executeWithCircuitBreaker).toHaveBeenCalledTimes(1);
    const [circuitId, operation, config] =
      circuitBreakerMock.executeWithCircuitBreaker.mock.calls[0];
    expect(circuitId).toBe('payment-refund-pay_2');
    expect(typeof operation).toBe('function');
    expect(config && typeof (config as any).fallback).toBe('function');
    await operation();
    expect(paymentGatewayMock.refundPayment).toHaveBeenCalledWith('pay_2', 700);
  });

  it('voidPayment should call circuit breaker with proper ID and delegate operation', async () => {
    await gateway.voidPayment('pay_3');
    expect(circuitBreakerMock.executeWithCircuitBreaker).toHaveBeenCalledTimes(1);
    const [circuitId, operation, config] =
      circuitBreakerMock.executeWithCircuitBreaker.mock.calls[0];
    expect(circuitId).toBe('payment-void-pay_3');
    expect(typeof operation).toBe('function');
    expect(config && typeof (config as any).fallback).toBe('function');
    await operation();
    expect(paymentGatewayMock.voidPayment).toHaveBeenCalledWith('pay_3');
  });

  it('getPaymentStatus should call circuit breaker with overrides and delegate operation', async () => {
    await gateway.getPaymentStatus('pay_4');
    expect(circuitBreakerMock.executeWithCircuitBreaker).toHaveBeenCalledTimes(1);
    const [circuitId, operation, config] =
      circuitBreakerMock.executeWithCircuitBreaker.mock.calls[0];
    expect(circuitId).toBe('payment-status-pay_4');
    expect(typeof operation).toBe('function');
    expect(config && typeof (config as any).fallback).toBe('function');
    expect((config as any).resetTimeoutMs).toBe(15000);
    expect((config as any).failureThreshold).toBe(10);
    await operation();
    expect(paymentGatewayMock.getPaymentStatus).toHaveBeenCalledWith('pay_4');
  });

  it('authorizePayment fallback should produce FAILED result when circuit is open', async () => {
    circuitBreakerMock.executeWithCircuitBreaker.mockImplementation(async (_id, _op, config) => {
      const err = new Error('circuit open');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return (config!.fallback as (e: Error) => Promise<PaymentResult> | PaymentResult)(
        err,
      ) as PaymentResult;
    });
    const res = await gateway.authorizePayment(paymentDetails);
    expect(res.success).toBe(false);
    expect(res.status).toBe(PaymentStatus.FAILED);
    expect(res.errorCode).toBe('authorize_circuit_open');
    expect(res.errorMessage).toContain('circuit open');
    expect(res.paymentId).toBe(paymentDetails.orderId);
    expect(res.gatewayResponse).toEqual({
      error: { code: 'authorize_circuit_open', message: expect.stringContaining('circuit open') },
    });
  });

  it('capturePayment fallback should produce FAILED result when circuit is open', async () => {
    circuitBreakerMock.executeWithCircuitBreaker.mockImplementation(async (_id, _op, config) => {
      const err = new Error('circuit open');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return (config!.fallback as (e: Error) => Promise<PaymentResult> | PaymentResult)(
        err,
      ) as PaymentResult;
    });
    const res = await gateway.capturePayment('pay_c', 100);
    expect(res.success).toBe(false);
    expect(res.status).toBe(PaymentStatus.FAILED);
    expect(res.errorCode).toBe('capture_circuit_open');
    expect(res.errorMessage).toContain('circuit open');
    expect(res.paymentId).toBe('pay_c');
  });

  it('refundPayment fallback should produce FAILED result when circuit is open', async () => {
    circuitBreakerMock.executeWithCircuitBreaker.mockImplementation(async (_id, _op, config) => {
      const err = new Error('circuit open');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return (config!.fallback as (e: Error) => Promise<PaymentResult> | PaymentResult)(
        err,
      ) as PaymentResult;
    });
    const res = await gateway.refundPayment('pay_r', 50);
    expect(res.success).toBe(false);
    expect(res.status).toBe(PaymentStatus.FAILED);
    expect(res.errorCode).toBe('refund_circuit_open');
    expect(res.errorMessage).toContain('circuit open');
    expect(res.paymentId).toBe('pay_r');
  });

  it('voidPayment fallback should produce FAILED result when circuit is open', async () => {
    circuitBreakerMock.executeWithCircuitBreaker.mockImplementation(async (_id, _op, config) => {
      const err = new Error('circuit open');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return (config!.fallback as (e: Error) => Promise<PaymentResult> | PaymentResult)(
        err,
      ) as PaymentResult;
    });
    const res = await gateway.voidPayment('pay_v');
    expect(res.success).toBe(false);
    expect(res.status).toBe(PaymentStatus.FAILED);
    expect(res.errorCode).toBe('void_circuit_open');
    expect(res.errorMessage).toContain('circuit open');
    expect(res.paymentId).toBe('pay_v');
  });

  it('getPaymentStatus fallback should produce FAILED result when circuit is open', async () => {
    circuitBreakerMock.executeWithCircuitBreaker.mockImplementation(async (_id, _op, config) => {
      const err = new Error('circuit open');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return (config!.fallback as (e: Error) => Promise<PaymentResult> | PaymentResult)(
        err,
      ) as PaymentResult;
    });
    const res = await gateway.getPaymentStatus('pay_s');
    expect(res.success).toBe(false);
    expect(res.status).toBe(PaymentStatus.FAILED);
    expect(res.errorCode).toBe('status_circuit_open');
    expect(res.errorMessage).toContain('circuit open');
    expect(res.paymentId).toBe('pay_s');
  });
});
