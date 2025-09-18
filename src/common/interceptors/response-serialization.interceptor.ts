import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';
import { instanceToPlain } from 'class-transformer';

/**
 * Interceptor for optimizing API response serialization
 */
@Injectable()
export class ResponseSerializationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseSerializationInterceptor.name);
  private readonly enableDetailedMetrics: boolean;
  private readonly serializationThresholdMs: number;

  constructor(private readonly configService: ConfigService) {
    this.enableDetailedMetrics = this.configService.get<boolean>('API_DETAILED_METRICS', false);
    this.serializationThresholdMs = this.configService.get<number>(
      'API_SERIALIZATION_THRESHOLD_MS',
      50,
    );
  }

  /**
   * Intercept the response and optimize serialization
   * @param context The execution context
   * @param next The next handler
   * @returns The transformed observable
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = performance.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      map((data: unknown) => {
        // Skip serialization for non-object responses
        if (data === null || data === undefined || typeof data !== 'object') {
          return data;
        }

        const serializationStartTime = performance.now();

        // Use class-transformer for efficient serialization
        const serialized = this.serialize(data);

        const serializationEndTime = performance.now();
        const serializationTime = serializationEndTime - serializationStartTime;
        const totalTime = serializationEndTime - startTime;

        // Log slow serialization
        if (serializationTime > this.serializationThresholdMs) {
          this.logger.warn(
            `Slow serialization detected (${serializationTime.toFixed(2)}ms) for ${method} ${url}`,
          );
        }

        // Add performance metrics if enabled
        if (this.enableDetailedMetrics) {
          this.logger.debug(
            `Response metrics: ${method} ${url} - Processing: ${(serializationStartTime - startTime).toFixed(2)}ms, ` +
              `Serialization: ${serializationTime.toFixed(2)}ms, Total: ${totalTime.toFixed(2)}ms`,
          );
        }

        return serialized;
      }),
    );
  }

  /**
   * Serialize the data efficiently
   * @param data The data to serialize
   * @returns The serialized data
   */
  private serialize(data: unknown): unknown {
    try {
      // Handle arrays
      if (Array.isArray(data)) {
        return data.map((item) => this.serializeItem(item));
      }

      // Handle pagination results
      if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
        return {
          ...data,
          items: data.items.map((item) => this.serializeItem(item)),
        };
      }

      // Handle single objects
      return this.serializeItem(data);
    } catch (error) {
      this.logger.error(
        `Serialization error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return data; // Return original data on error
    }
  }

  /**
   * Serialize a single item
   * @param item The item to serialize
   * @returns The serialized item
   */
  private serializeItem(item: unknown): unknown {
    // Skip primitive values
    if (item === null || item === undefined || typeof item !== 'object') {
      return item;
    }

    // Use class-transformer for class instances
    if (
      typeof item === 'object' &&
      item !== null &&
      'constructor' in item &&
      item.constructor &&
      item.constructor !== Object
    ) {
      return this.serializeClassInstance(item);
    }

    // Handle plain objects
    return this.serializePlainObject(item);
  }

  /**
   * Serialize a class instance using class-transformer
   * @param item The class instance to serialize
   * @returns The serialized class instance
   */
  private serializeClassInstance(item: object): unknown {
    return instanceToPlain(item, {
      enableCircularCheck: true,
      excludePrefixes: ['_'],
    });
  }

  /**
   * Serialize a plain object
   * @param item The plain object to serialize
   * @returns The serialized plain object
   */
  private serializePlainObject(item: object): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const objectItem = item as Record<string, unknown>;

    for (const key in objectItem) {
      // Skip private properties
      if (key.startsWith('_')) {
        continue;
      }

      const value = objectItem[key];
      result[key] = this.serializeObjectValue(value);
    }

    return result;
  }

  /**
   * Serialize an object value
   * @param value The value to serialize
   * @returns The serialized value
   */
  private serializeObjectValue(value: unknown): unknown {
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map((v) => this.serializeItem(v));
      } else {
        return this.serializeItem(value);
      }
    }
    return value;
  }
}
