import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as opentelemetry from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

/**
 * JaegerTracingService provides functionality for Jaeger distributed tracing.
 * It initializes OpenTelemetry SDK with Jaeger exporter.
 */
@Injectable()
export class JaegerTracingService {
  private readonly enabled: boolean;
  private readonly serviceName: string;
  private readonly jaegerEndpoint: string;
  private sdk: opentelemetry.NodeSDK | null = null;

  public constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('TRACING_ENABLED', false);
    this.serviceName = this.configService.get<string>('SERVICE_NAME', 'swifteats-backend');
    this.jaegerEndpoint = this.configService.get<string>(
      'JAEGER_ENDPOINT',
      'http://localhost:14268/api/traces',
    );
  }

  /**
   * Initialize OpenTelemetry SDK with Jaeger exporter.
   */
  public init(): void {
    if (!this.enabled) {
      return;
    }

    try {
      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.configService.get<string>(
            'NODE_ENV',
            'development',
          ),
        }),
      );

      const jaegerExporter = new JaegerExporter({
        endpoint: this.jaegerEndpoint,
      });

      this.sdk = new opentelemetry.NodeSDK({
        resource,
        traceExporter: jaegerExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Enable all auto-instrumentations
            '@opentelemetry/instrumentation-fs': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-http': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-express': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-nestjs-core': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-pg': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-redis': {
              enabled: true,
            },
          }),
        ],
      });

      // Start the SDK
      this.sdk.start();

      // Handle shutdown gracefully
      const shutdownHandler = (): void => {
        this.shutdown()
          .then(() => process.exit(0))
          .catch((error) => {
            console.error('Error during shutdown:', error);
            process.exit(1);
          });
      };

      process.on('SIGTERM', shutdownHandler);
      process.on('SIGINT', shutdownHandler);
    } catch (error) {
      console.error('Failed to initialize Jaeger tracing', error);
    }
  }

  /**
   * Shutdown OpenTelemetry SDK.
   */
  public async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.sdk = null;
    }
  }
}
