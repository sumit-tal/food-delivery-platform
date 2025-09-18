import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';

// Define types for compression middleware
type CompressionFilter = (req: Request, res: Response) => boolean;

/**
 * Interface for tracking compression metrics
 */
interface BytesTracker {
  beforeCompression: number;
}

/**
 * Type for Response end method
 */
type ResponseEndMethod = (
  chunk?: unknown,
  encoding?: BufferEncoding | (() => void),
  callback?: () => void,
) => Response;

/**
 * Type for Response write method
 */
type ResponseWriteMethod = (
  chunk: unknown,
  encoding?: BufferEncoding | ((error?: Error | null) => void),
  callback?: (error?: Error | null) => void,
) => boolean;

/**
 * Enhanced compression middleware for bandwidth efficiency
 */
@Injectable()
export class EnhancedCompressionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(EnhancedCompressionMiddleware.name);
  private readonly compressionMiddleware: ReturnType<typeof compression>;
  private readonly compressionThresholdBytes: number;
  private readonly enableDetailedMetrics: boolean;

  constructor(private readonly configService: ConfigService) {
    this.compressionThresholdBytes = this.configService.get<number>(
      'COMPRESSION_THRESHOLD_BYTES',
      1024,
    );
    this.enableDetailedMetrics = this.configService.get<boolean>('API_DETAILED_METRICS', false);

    // Configure compression middleware with optimized settings
    this.compressionMiddleware = compression({
      // Only compress responses larger than threshold
      threshold: this.compressionThresholdBytes,
      // Configure gzip compression level (1-9, where 1 is fastest, 9 is best compression)
      level: 6,
      // Don't compress responses that are already compressed
      filter: this.createCompressionFilter(),
    });
  }

  /**
   * Apply enhanced compression middleware
   * @param req The request object
   * @param res The response object
   * @param next The next function
   */
  use(req: Request, res: Response, next: NextFunction): void {
    if (this.enableDetailedMetrics) {
      this.setupMetricsTracking(req, res);
    }

    // Apply compression middleware
    this.compressionMiddleware(req, res, next);
  }

  /**
   * Creates a filter function to determine which responses should be compressed
   * @returns Compression filter function
   */
  private createCompressionFilter(): CompressionFilter {
    return (req: Request, res: Response): boolean => {
      const contentTypeHeader = res.getHeader('Content-Type');
      if (!contentTypeHeader) {
        return true; // Default to compressing if no content type
      }

      const contentType = String(contentTypeHeader);

      // Skip compression for already compressed formats
      if (this.isPreCompressedContentType(contentType)) {
        return false;
      }

      // Default compression behavior for text-based content types
      return true;
    };
  }

  /**
   * Checks if the content type is already compressed
   * @param contentType Content type header value
   * @returns True if content type is pre-compressed
   */
  private isPreCompressedContentType(contentType: string): boolean {
    return (
      contentType.includes('image/') ||
      contentType.includes('video/') ||
      contentType.includes('audio/') ||
      contentType.includes('application/zip') ||
      contentType.includes('application/gzip') ||
      contentType.includes('application/x-gzip') ||
      contentType.includes('application/x-compressed') ||
      contentType.includes('application/x-7z-compressed') ||
      contentType.includes('application/x-rar-compressed')
    );
  }

  /**
   * Sets up metrics tracking for compression
   * @param req The request object
   * @param res The response object
   */
  private setupMetricsTracking(req: Request, res: Response): void {
    this.setupResponseWriteTracking(res);
    this.setupResponseEndTracking(req, res);
  }

  /**
   * Sets up tracking for response write method
   * @param res The response object
   */
  private setupResponseWriteTracking(res: Response): void {
    // Store the original write method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalWrite = (res as any).write as ResponseWriteMethod;
    // Use this variable to track bytes across function calls
    const bytesTracker: BytesTracker = { beforeCompression: 0 };

    // Track bytes before compression
    this.trackBytesBeforeCompression(res, originalWrite, bytesTracker);

    // Store the bytes tracker on the response object for later use
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any)._bytesTracker = bytesTracker;
  }

  /**
   * Track bytes before compression by overriding write method
   * @param res Response object
   * @param originalWrite Original write method
   * @param bytesTracker Bytes tracker object
   */
  private trackBytesBeforeCompression(
    res: Response,
    originalWrite: ResponseWriteMethod,
    bytesTracker: BytesTracker,
  ): void {
    // Create a wrapped write function that tracks bytes
    const trackedWriteFunction = this.createTrackedWriteFunction(originalWrite, bytesTracker);

    // Apply the tracking function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).write = trackedWriteFunction;
  }

  /**
   * Create a tracked write function that measures bytes before compression
   */
  private createTrackedWriteFunction(
    originalWrite: ResponseWriteMethod,
    bytesTracker: BytesTracker,
  ): ResponseWriteMethod {
    return function (
      this: Response,
      chunk: unknown,
      encoding?: string | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ): boolean {
      // Track bytes if chunk exists
      if (chunk) {
        if (Buffer.isBuffer(chunk)) {
          bytesTracker.beforeCompression += chunk.length;
        } else if (typeof chunk === 'string') {
          const enc = typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8';
          bytesTracker.beforeCompression += Buffer.byteLength(chunk, enc);
        }
      }

      // Handle different argument patterns
      if (typeof encoding === 'function') {
        // @ts-expect-error: Handle function overload pattern
        return originalWrite.call(this, chunk, null, encoding);
      }
      return originalWrite.call(this, chunk, encoding as BufferEncoding, callback);
    };
  }

  /**
   * Sets up tracking for response end method
   * @param req The request object
   * @param res The response object
   */
  private setupResponseEndTracking(req: Request, res: Response): void {
    // Store the original end method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalEnd = (res as any).end as ResponseEndMethod;
    // Override end method to track bytes and log metrics
    this.trackEndResponseAndLogMetrics(req, res, originalEnd);
  }

  /**
   * Track end response and log metrics
   * @param req Request object
   * @param res Response object
   * @param originalEnd Original end method
   */
  private trackEndResponseAndLogMetrics(
    req: Request,
    res: Response,
    originalEnd: ResponseEndMethod,
  ): void {
    // Create tracked end function
    const trackedEndFunction = this.createTrackedEndFunction(req, originalEnd);

    // Apply the tracking function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).end = trackedEndFunction;
  }

  /**
   * Create a tracked end function that measures bytes and logs metrics
   */
  private createTrackedEndFunction(
    req: Request,
    originalEnd: ResponseEndMethod,
  ): ResponseEndMethod {
    // Store reference to middleware instance for the closure
    const middleware = this;

    return function (
      this: Response,
      chunk?: unknown,
      encoding?: string | (() => void),
      callback?: () => void,
    ): Response {
      // Get the bytes tracker from the response object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bytesTracker: BytesTracker = ((this as any)._bytesTracker as BytesTracker) || {
        beforeCompression: 0,
      };

      // Track bytes if chunk exists
      middleware.trackChunkBytes(chunk, encoding, bytesTracker);

      // Handle different argument patterns and get result
      const result = middleware.handleEndArguments(this, originalEnd, chunk, encoding, callback);

      // Log compression metrics after response is sent
      middleware.logCompressionMetrics(req, bytesTracker);

      return result;
    };
  }

  /**
   * Track bytes in chunk for end method
   * @param chunk The chunk data
   * @param encoding The encoding or callback
   * @param bytesTracker The bytes tracker object
   */
  private trackChunkBytes(
    chunk: unknown,
    encoding: string | (() => void) | undefined,
    bytesTracker: BytesTracker,
  ): void {
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        bytesTracker.beforeCompression += chunk.length;
      } else if (typeof chunk === 'string') {
        const enc = typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8';
        bytesTracker.beforeCompression += Buffer.byteLength(chunk, enc);
      }
    }
  }

  /**
   * Handle different argument patterns for end method
   * @param res The response object
   * @param originalEnd The original end method
   * @param chunk The chunk data
   * @param encoding The encoding or callback
   * @param callback The callback function
   * @returns The response object
   */
  private handleEndArguments(
    res: Response,
    originalEnd: ResponseEndMethod,
    chunk?: unknown,
    encoding?: string | (() => void),
    callback?: () => void,
  ): Response {
    // Handle different argument patterns
    if (typeof encoding === 'function') {
      // encoding is actually a callback
      return originalEnd.call(res, chunk, encoding);
    }
    return originalEnd.call(res, chunk, encoding as BufferEncoding, callback);
  }

  /**
   * Logs compression metrics
   * @param req The request object
   * @param bytesTracker The bytes tracker object
   */
  private logCompressionMetrics(req: Request, bytesTracker: BytesTracker): void {
    const bytesBeforeCompression = bytesTracker.beforeCompression;
    // Get content length from response
    const response = req.res as Response;
    const contentLengthHeader = response.getHeader('Content-Length');
    const bytesAfterCompression = contentLengthHeader
      ? parseInt(String(contentLengthHeader), 10)
      : 0;

    if (bytesBeforeCompression > 0 && bytesAfterCompression > 0) {
      const compressionRatio = (1 - bytesAfterCompression / bytesBeforeCompression) * 100;
      Logger.debug(
        `Compression: ${req.method} ${req.url} - Before: ${bytesBeforeCompression} bytes, ` +
          `After: ${bytesAfterCompression} bytes, Ratio: ${compressionRatio.toFixed(2)}%`,
        'EnhancedCompressionMiddleware',
      );
    }
  }
}
