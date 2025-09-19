import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface SecurityValidationOptions {
  maxBodySize?: number;
  allowedContentTypes?: string[];
  sanitizeInput?: boolean;
  validateHeaders?: boolean;
  blockSuspiciousPatterns?: boolean;
}

/**
 * SecurityValidationMiddleware provides comprehensive input validation and sanitization
 */
@Injectable()
export class SecurityValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityValidationMiddleware.name);

  // Common suspicious patterns that might indicate attacks
  private readonly suspiciousPatterns = [
    // SQL Injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /('|(\\x27)|(\\x2D\\x2D)|(%27)|(%2D%2D))/i,

    // XSS patterns
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i,

    // Path traversal patterns
    /\.\.[\/\\]/,
    /(\.\.%2f|\.\.%5c)/i,

    // Command injection patterns
    /[;&|`$(){}[\]]/,

    // LDAP injection patterns
    /[()&|!]/,
  ];

  private readonly defaultOptions: SecurityValidationOptions = {
    maxBodySize: 10 * 1024 * 1024, // 10MB
    allowedContentTypes: [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain',
    ],
    sanitizeInput: true,
    validateHeaders: true,
    blockSuspiciousPatterns: true,
  };

  public use(req: Request, res: Response, next: NextFunction): void {
    const options = { ...this.defaultOptions };

    try {
      this.validateRequest(req, options);
      next();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Security validation failed:', {
        ip: this.getClientIp(req),
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
        error: errorMessage,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Invalid request format');
    }
  }

  private validateRequest(req: Request, options: SecurityValidationOptions): void {
    // Validate content type
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      this.validateContentType(req, options);
    }

    // Validate body size
    this.validateBodySize(req, options);

    // Validate headers
    if (options.validateHeaders) {
      this.validateHeaders(req);
    }

    // Check for suspicious patterns
    if (options.blockSuspiciousPatterns) {
      this.checkSuspiciousPatterns(req);
    }

    // Sanitize input
    if (options.sanitizeInput) {
      this.sanitizeInput(req);
    }
  }

  private validateContentType(req: Request, options: SecurityValidationOptions): void {
    const contentType = req.headers['content-type'];

    if (!contentType) {
      throw new BadRequestException('Content-Type header is required');
    }

    const isAllowed = options.allowedContentTypes?.some((allowed) =>
      contentType.toLowerCase().includes(allowed.toLowerCase()),
    );

    if (!isAllowed) {
      throw new BadRequestException('Unsupported content type');
    }
  }

  private validateBodySize(req: Request, options: SecurityValidationOptions): void {
    const contentLength = req.headers['content-length'];

    if (contentLength && parseInt(contentLength, 10) > (options.maxBodySize || 0)) {
      throw new BadRequestException('Request body too large');
    }
  }

  private validateHeaders(req: Request): void {
    // Check for required security headers in responses (this would be in a response middleware)
    // For now, validate request headers for suspicious content

    const suspiciousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];

    for (const header of suspiciousHeaders) {
      const value = req.headers[header];
      if (value && typeof value === 'string') {
        if (this.containsSuspiciousPattern(value)) {
          throw new BadRequestException(`Suspicious content in ${header} header`);
        }
      }
    }

    // Validate User-Agent header
    const userAgent = req.headers['user-agent'];
    if (userAgent && typeof userAgent === 'string') {
      if (userAgent.length > 512) {
        throw new BadRequestException('User-Agent header too long');
      }
    }
  }

  private checkSuspiciousPatterns(req: Request): void {
    // Check URL path
    if (this.containsSuspiciousPattern(req.path)) {
      throw new BadRequestException('Suspicious pattern detected in URL');
    }

    // Check query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && this.containsSuspiciousPattern(value)) {
        throw new BadRequestException(`Suspicious pattern detected in query parameter: ${key}`);
      }
    }

    // Check request body
    if (req.body && typeof req.body === 'object') {
      this.checkObjectForSuspiciousPatterns(req.body, 'body');
    }
  }

  private checkObjectForSuspiciousPatterns(obj: unknown, path: string): void {
    if (typeof obj === 'string') {
      if (this.containsSuspiciousPattern(obj)) {
        throw new BadRequestException(`Suspicious pattern detected in ${path}`);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.checkObjectForSuspiciousPatterns(item, `${path}[${index}]`);
      });
    } else if (obj && typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        this.checkObjectForSuspiciousPatterns(value, `${path}.${key}`);
      });
    }
  }

  private containsSuspiciousPattern(input: string): boolean {
    return this.suspiciousPatterns.some((pattern) => pattern.test(input));
  }

  private sanitizeInput(req: Request): void {
    // Sanitize query parameters
    req.query = this.sanitizeObject(req.query) as typeof req.query;

    // Sanitize request body
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }
  }

  private sanitizeObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    } else if (obj && typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      Object.entries(obj).forEach(([key, value]) => {
        sanitized[key] = this.sanitizeObject(value);
      });
      return sanitized;
    }
    return obj;
  }

  private sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes that could be used in injection
      .trim();
  }

  private getClientIp(req: Request): string {
    // Try to get IP from various headers and connection properties
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      const firstIp = forwardedFor.split(',')[0]?.trim();
      if (firstIp) return firstIp;
    }

    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') {
      return realIp;
    }

    // Fallback to connection properties (with proper type handling)
    const connection = req.connection as { remoteAddress?: string } | undefined;
    if (connection?.remoteAddress) {
      return connection.remoteAddress;
    }

    const socket = req.socket as { remoteAddress?: string } | undefined;
    if (socket?.remoteAddress) {
      return socket.remoteAddress;
    }

    return 'unknown';
  }
}
