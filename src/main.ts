import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { APP_CONSTANTS } from './common/constants/app.constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.use(compression());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix(`${APP_CONSTANTS.API_PREFIX}/${APP_CONSTANTS.API_VERSION}`);
  app.enableShutdownHooks();
  const port: number = Number(process.env.PORT) || APP_CONSTANTS.DEFAULT_PORT;
  await app.listen(port);
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
