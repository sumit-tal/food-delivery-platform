import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * HttpExceptionFilter provides consistent error responses across the API.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse<Response>();
    const request: Request = ctx.getRequest<Request>();
    const status: number = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    if (exception instanceof HttpException) {
      const body: unknown = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const maybeMessage: unknown = (body as { message?: unknown }).message;
        message = typeof maybeMessage === 'string' ? maybeMessage : JSON.stringify(body);
      } else {
        message = exception.message;
      }
    }
    response.status(status).json({ statusCode: status, path: request?.url, timestamp: new Date().toISOString(), message });
  }
}
