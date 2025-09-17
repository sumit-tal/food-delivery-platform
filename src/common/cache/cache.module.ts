import { Module, DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EnhancedRedisCache } from './enhanced-redis-cache.service';

export interface CacheModuleOptions {
  isGlobal?: boolean;
  prefix?: string;
}

@Module({})
export class CacheModule {
  /**
   * Registers the CacheModule for use in the application.
   * 
   * @param options - Configuration options for the cache module
   * @returns Dynamic module configuration
   */
  static register(options: CacheModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: EnhancedRedisCache,
        useFactory: (configService: ConfigService, eventEmitter: EventEmitter2): EnhancedRedisCache => {
          const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');
          return new EnhancedRedisCache(redisUrl, eventEmitter, options.prefix);
        },
        inject: [ConfigService, EventEmitter2],
      },
    ];

    return {
      global: options.isGlobal ?? false,
      imports: [ConfigModule, EventEmitterModule.forRoot()],
      module: CacheModule,
      providers,
      exports: [EnhancedRedisCache],
    };
  }
}

// Re-export for convenience
export * from './cache.interface';
export * from './enhanced-redis-cache.service';
