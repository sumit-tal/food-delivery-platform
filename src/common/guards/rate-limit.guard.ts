import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RateLimitingService, RateLimitConfig } from '../security/rate-limiting.service';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions extends RateLimitConfig {
  message?: string;
  statusCode?: number;
}

/**
 * Decorator to set rate limiting configuration for endpoints
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Default rate limiting configurations for different endpoint types
 */
export const RateLimitPresets = {
  // Authentication endpoints - stricter limits
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later',
  },
  // API endpoints - standard limits
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests, please try again later',
  },
  // Public endpoints - more lenient
  PUBLIC: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    message: 'Too many requests, please try again later',
  },
  // File upload endpoints - very strict
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Too many upload attempts, please try again later',
  },
};

/**
 * RateLimitGuard implements Redis-backed rate limiting for API endpoints
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitingService: RateLimitingService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const rateLimitConfig = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!rateLimitConfig) {
      return true; // No rate limiting configured
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return this.processRateLimit(request, response, rateLimitConfig);
  }

  private generateKey(request: Request, config: RateLimitOptions): string {
    if (config.keyGenerator) {
      return config.keyGenerator(request);
    }

    // Default key generation strategy
    const ip = this.getClientIp(request);
    const userId = (request as any).user?.id;
    const endpoint = `${request.method}:${request.route?.path || request.path}`;

    // Use user ID if authenticated, otherwise use IP
    const identifier = userId || ip;
    return `${identifier}:${endpoint}`;
  }

  /**
   * Process rate limiting for the request
   */
  private processRateLimit(
    request: Request,
    response: Response,
    rateLimitConfig: RateLimitOptions,
  ): boolean {
    const key = this.generateKey(request, rateLimitConfig);
    const result = this.rateLimitingService.checkRateLimit(key, rateLimitConfig);

    this.setRateLimitHeaders(response, rateLimitConfig, result);

    if (!result.allowed) {
      this.throwRateLimitException(response, rateLimitConfig, result);
    }

    return true;
  }

  /**
   * Set rate limit headers on response
   */
  private setRateLimitHeaders(
    response: Response,
    config: RateLimitOptions,
    result: { remaining: number; resetTime: number },
  ): void {
    response.setHeader('X-RateLimit-Limit', config.maxRequests);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
    response.setHeader('X-RateLimit-Window', config.windowMs);
  }

  /**
   * Throw rate limit exceeded exception
   */
  private throwRateLimitException(
    response: Response,
    config: RateLimitOptions,
    result: { resetTime: number },
  ): never {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    response.setHeader('Retry-After', retryAfter);

    throw new HttpException(
      {
        statusCode: config.statusCode || HttpStatus.TOO_MANY_REQUESTS,
        message: config.message || 'Too many requests',
        error: 'Too Many Requests',
        retryAfter,
      },
      config.statusCode || HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}
