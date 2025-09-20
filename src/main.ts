import 'reflect-metadata';
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';

// Load environment variables before anything else
config();

// Debug: Log critical environment variables
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { APP_CONSTANTS } from './common/constants/app.constants';
import { EnhancedCompressionMiddleware } from './common/middleware/enhanced-compression.middleware';
import { SecurityValidationMiddleware } from './common/middleware/security-validation.middleware';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function getHttpsOptions(): any {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return undefined; // Use HTTP in development
  }

  try {
    // In production, load SSL certificates
    const keyPath = process.env.SSL_KEY_PATH || '/etc/ssl/private/server.key';
    const certPath = process.env.SSL_CERT_PATH || '/etc/ssl/certs/server.crt';

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    }
  } catch (error) {
    console.warn('SSL certificates not found, falling back to HTTP');
  }

  return undefined;
}

async function bootstrap(): Promise<void> {
  // HTTPS Configuration for production
  const httpsOptions = getHttpsOptions();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    httpsOptions,
  });

  // Security Headers with Helmet
  app.use(
    helmet({
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Security validation middleware
  const securityValidationMiddleware = app.get(SecurityValidationMiddleware);
  app.use(securityValidationMiddleware.use.bind(securityValidationMiddleware));

  // Enhanced compression middleware
  const compressionMiddleware = app.get(EnhancedCompressionMiddleware);
  app.use(compressionMiddleware.use.bind(compressionMiddleware));

  // Global validation pipe with security enhancements
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix(`${APP_CONSTANTS.API_PREFIX}/${APP_CONSTANTS.API_VERSION}`);
  app.enableShutdownHooks();

  // Swagger API Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('SwiftEats API')
    .setDescription('Food delivery platform backend API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port: number = Number(process.env.PORT) || APP_CONSTANTS.DEFAULT_PORT;
  await app.listen(port);
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
