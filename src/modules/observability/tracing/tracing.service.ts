import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as opentelemetry from '@opentelemetry/api';
import { JaegerTracingService } from './jaeger-tracing.service';

/**
 * TracingService provides functionality for distributed tracing.
 * It wraps OpenTelemetry API and provides methods for creating and managing spans.
 */
@Injectable()
export class TracingService implements OnModuleInit {
  private enabled: boolean;
  private tracer: opentelemetry.Tracer | null = null;

  public constructor(
    private readonly configService: ConfigService,
    private readonly jaegerTracingService: JaegerTracingService,
  ) {
    this.enabled = this.configService.get<boolean>('TRACING_ENABLED', false);
  }

  /**
   * Initialize tracing when module starts.
   */
  public onModuleInit(): void {
    if (!this.enabled) {
      return;
    }

    try {
      this.jaegerTracingService.init();
      this.tracer = opentelemetry.trace.getTracer('swifteats-backend');
    } catch (error) {
      console.error('Failed to initialize tracing', error);
      this.enabled = false;
    }
  }

  /**
   * Start a new span.
   * @param name - Span name
   * @param options - Span options
   * @returns Span instance
   */
  public startSpan(name: string, options?: opentelemetry.SpanOptions): opentelemetry.Span {
    if (!this.enabled || !this.tracer) {
      return opentelemetry.trace.wrapSpanContext(opentelemetry.INVALID_SPAN_CONTEXT);
    }

    return this.tracer.startSpan(name, options);
  }

  /**
   * Start a new span and make it active.
   * @param name - Span name
   * @param options - Span options
   * @returns Span context instance
   */
  public startActiveSpan<T>(
    name: string,
    options: opentelemetry.SpanOptions,
    fn: (span: opentelemetry.Span) => T,
  ): T {
    if (!this.enabled || !this.tracer) {
      const span = opentelemetry.trace.wrapSpanContext(opentelemetry.INVALID_SPAN_CONTEXT);
      return fn(span);
    }

    return this.tracer.startActiveSpan(name, options, fn);
  }

  /**
   * Get the current active span.
   * @returns Current active span
   */
  public getCurrentSpan(): opentelemetry.Span {
    return (
      opentelemetry.trace.getSpan(opentelemetry.context.active()) ||
      opentelemetry.trace.wrapSpanContext(opentelemetry.INVALID_SPAN_CONTEXT)
    );
  }

  /**
   * Add an attribute to the current active span.
   * @param key - Attribute key
   * @param value - Attribute value
   */
  public addAttribute(key: string, value: opentelemetry.AttributeValue): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }

  /**
   * Add an event to the current active span.
   * @param name - Event name
   * @param attributes - Event attributes
   */
  public addEvent(name: string, attributes?: opentelemetry.Attributes): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set the status of the current active span.
   * @param status - Span status
   * @param message - Status message
   */
  public setStatus(status: opentelemetry.SpanStatusCode, message?: string): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.setStatus({ code: status, message });
    }
  }

  /**
   * End the current active span.
   */
  public endSpan(): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.end();
    }
  }
}
