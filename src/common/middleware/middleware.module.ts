import { Module, Global } from '@nestjs/common';
import { SecurityValidationMiddleware } from './security-validation.middleware';
import { EnhancedCompressionMiddleware } from './enhanced-compression.middleware';

/**
 * MiddlewareModule provides global middleware components for the application
 */
@Global()
@Module({
  providers: [
    SecurityValidationMiddleware,
    EnhancedCompressionMiddleware,
  ],
  exports: [
    SecurityValidationMiddleware,
    EnhancedCompressionMiddleware,
  ],
})
export class MiddlewareModule {}
