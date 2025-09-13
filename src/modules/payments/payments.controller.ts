import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  UseGuards, 
  HttpException, 
  HttpStatus,
  Logger
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentStatus, PaymentResult } from './interfaces/payment-gateway.interface';

/**
 * Controller for payment-related endpoints
 */
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Process a payment
   * @param processPaymentDto Payment details
   * @returns Payment response
   */
  @Post()
  @Roles('customer', 'admin')
  async processPayment(@Body() processPaymentDto: ProcessPaymentDto): Promise<PaymentResponseDto> {
    try {
      const result = await this.paymentsService.processPayment(
        processPaymentDto.orderId,
        processPaymentDto.amount,
        processPaymentDto.currency,
        processPaymentDto.paymentMethod,
        processPaymentDto.customerId,
        processPaymentDto.customerEmail,
        processPaymentDto.metadata
      );

      // Add id property to the result for type compatibility
      const resultWithId = {
        ...result,
        id: result.paymentId || 'unknown'
      };
      
      return this.createPaymentResponse(resultWithId, processPaymentDto);
    } catch (error) {
      this.handlePaymentError(error as Error, 'processing payment');
    }
  }
  
  /**
   * Create payment response DTO from payment result
   * @param result Payment result
   * @param paymentDto Payment request DTO
   * @returns Payment response DTO
   */
  private createPaymentResponse(
    result: PaymentResult & { id: string }, 
    paymentDto: ProcessPaymentDto
  ): PaymentResponseDto {
    return {
      id: result.id,
      orderId: paymentDto.orderId,
      success: result.success,
      status: result.status || PaymentStatus.FAILED,
      amount: paymentDto.amount,
      currency: paymentDto.currency,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      timestamp: result.timestamp || new Date()
    };
  }

  /**
   * Refund a payment
   * @param refundPaymentDto Refund details
   * @returns Refund response
   */
  @Post('refund')
  @Roles('admin')
  async refundPayment(@Body() refundPaymentDto: RefundPaymentDto): Promise<PaymentResponseDto> {
    try {
      const result = await this.paymentsService.refundPayment(
        refundPaymentDto.paymentId,
        refundPaymentDto.amount
      );

      // Get payment details
      const payment = await this.paymentsService.getPaymentById(refundPaymentDto.paymentId);

      return this.createRefundResponse(result, payment, refundPaymentDto);
    } catch (error) {
      this.handlePaymentError(error as Error, 'refunding payment');
    }
  }
  
  /**
   * Create refund response DTO
   * @param result Refund result
   * @param payment Payment entity
   * @param refundDto Refund request DTO
   * @returns Payment response DTO
   */
  private createRefundResponse(
    result: PaymentResult, 
    payment: PaymentEntity, 
    refundDto: RefundPaymentDto
  ): PaymentResponseDto {
    return {
      id: refundDto.paymentId,
      orderId: payment.orderId,
      success: result.success,
      status: result.status || PaymentStatus.FAILED,
      amount: refundDto.amount || payment.amount,
      currency: payment.currency,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      timestamp: result.timestamp || new Date()
    };
  }

  /**
   * Get payment by ID
   * @param id Payment ID
   * @returns Payment entity
   */
  @Get(':id')
  @Roles('customer', 'admin')
  async getPayment(@Param('id') id: string): Promise<PaymentEntity> {
    try {
      const payment = await this.paymentsService.getPaymentById(id);
      
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }
      
      return payment;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.handlePaymentError(error as Error, 'retrieving payment');
    }
  }

  /**
   * Get payments for an order
   * @param orderId Order ID
   * @returns List of payment entities
   */
  @Get('order/:orderId')
  @Roles('customer', 'admin')
  async getPaymentsByOrder(@Param('orderId') orderId: string): Promise<PaymentEntity[]> {
    try {
      return this.paymentsService.getPaymentsByOrderId(orderId);
    } catch (error) {
      this.handlePaymentError(error as Error, 'retrieving order payments');
    }
  }
  
  /**
   * Handle payment errors
   * @param error Error object
   * @param operation Operation description
   */
  private handlePaymentError(error: Error, operation: string): never {
    this.logger.error(`Error ${operation}: ${error.message}`, error.stack);
    throw new HttpException(
      `Error ${operation}: ${error.message}`,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
