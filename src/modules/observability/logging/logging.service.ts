import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchLoggerService } from './elasticsearch-logger.service';

/**
 * LogLevel enum defines the available log levels.
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

/**
 * LogContext interface defines the structure of log context.
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * LoggingService provides a centralized logging service.
 * It implements the NestJS LoggerService interface and adds additional functionality.
 */
@Injectable()
export class LoggingService implements NestLoggerService {
  private readonly serviceName: string;
  private readonly environment: string;
  private readonly logLevel: LogLevel;

  public constructor(
    private readonly configService: ConfigService,
    private readonly elasticsearchLogger: ElasticsearchLoggerService,
  ) {
    this.serviceName = this.configService.get<string>('SERVICE_NAME', 'swifteats-backend');
    this.environment = this.configService.get<string>('NODE_ENV', 'development');
    this.logLevel = this.parseLogLevel(
      this.configService.get<string>('LOG_LEVEL', 'info'),
    );
  }

  /**
   * Parse a string log level into a LogLevel enum value.
   * @param level - String log level
   * @returns LogLevel enum value
   */
  private parseLogLevel(level: string): LogLevel {
    const normalizedLevel = level.toLowerCase();
    switch (normalizedLevel) {
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
        return LogLevel.DEBUG;
      case 'verbose':
        return LogLevel.VERBOSE;
      default:
        return LogLevel.INFO;
    }
  }

  /**
   * Check if a log level should be logged based on the configured log level.
   * @param level - Log level to check
   * @returns Boolean indicating if the log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = [
      LogLevel.ERROR,
      LogLevel.WARN,
      LogLevel.INFO,
      LogLevel.DEBUG,
      LogLevel.VERBOSE,
    ];
    const configuredLevelIndex = levels.indexOf(this.logLevel);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex <= configuredLevelIndex;
  }

  /**
   * Format a log message with context.
   * @param level - Log level
   * @param message - Log message
   * @param context - Log context
   * @returns Formatted log object
   */
  private formatLog(
    level: LogLevel,
    message: string,
    context?: string | LogContext,
  ): Record<string, unknown> {
    const timestamp = new Date().toISOString();
    const logObject: Record<string, unknown> = {
      level,
      message,
      timestamp,
      service: this.serviceName,
      environment: this.environment,
    };

    if (context) {
      if (typeof context === 'string') {
        logObject.context = context;
      } else {
        Object.assign(logObject, context);
      }
    }

    return logObject;
  }

  /**
   * Log an error message.
   * @param message - Error message
   * @param trace - Error stack trace
   * @param context - Log context
   */
  public error(message: string, trace?: string, context?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) {
      return;
    }

    const logContext: LogContext = typeof context === 'string' ? { context } : {};
    if (trace) {
      logContext.trace = trace;
    }

    const logObject = this.formatLog(LogLevel.ERROR, message, logContext);
    console.error(JSON.stringify(logObject));
    this.elasticsearchLogger.log(logObject);
  }

  /**
   * Log a warning message.
   * @param message - Warning message
   * @param context - Log context
   */
  public warn(message: string, context?: string): void {
    if (!this.shouldLog(LogLevel.WARN)) {
      return;
    }

    const logObject = this.formatLog(LogLevel.WARN, message, context);
    console.warn(JSON.stringify(logObject));
    this.elasticsearchLogger.log(logObject);
  }

  /**
   * Log an info message.
   * @param message - Info message
   * @param context - Log context
   */
  public log(message: string, context?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) {
      return;
    }

    const logObject = this.formatLog(LogLevel.INFO, message, context);
    console.log(JSON.stringify(logObject));
    this.elasticsearchLogger.log(logObject);
  }

  /**
   * Log a debug message.
   * @param message - Debug message
   * @param context - Log context
   */
  public debug(message: string, context?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) {
      return;
    }

    const logObject = this.formatLog(LogLevel.DEBUG, message, context);
    console.debug(JSON.stringify(logObject));
    this.elasticsearchLogger.log(logObject);
  }

  /**
   * Log a verbose message.
   * @param message - Verbose message
   * @param context - Log context
   */
  public verbose(message: string, context?: string): void {
    if (!this.shouldLog(LogLevel.VERBOSE)) {
      return;
    }

    const logObject = this.formatLog(LogLevel.VERBOSE, message, context);
    console.debug(JSON.stringify(logObject));
    this.elasticsearchLogger.log(logObject);
  }

  /**
   * Log a message with custom context.
   * @param level - Log level
   * @param message - Log message
   * @param context - Log context
   */
  public logWithContext(
    level: LogLevel,
    message: string,
    context: LogContext,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logObject = this.formatLog(level, message, context);
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(JSON.stringify(logObject));
        break;
      case LogLevel.WARN:
        console.warn(JSON.stringify(logObject));
        break;
      case LogLevel.INFO:
        console.log(JSON.stringify(logObject));
        break;
      case LogLevel.DEBUG:
      case LogLevel.VERBOSE:
        console.debug(JSON.stringify(logObject));
        break;
    }

    this.elasticsearchLogger.log(logObject);
  }
}
