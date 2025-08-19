import { Module } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsRepository } from './repositories/restaurants.repository';
import { InMemoryMenuCache } from './cache/in-memory-menu-cache';
import { ConfigService } from '@nestjs/config';
import type { MenuCache } from './cache/menu-cache';

/**
 * RestaurantsModule bundles catalog components.
 */
@Module({
  controllers: [RestaurantsController],
  providers: [
    RestaurantsService,
    RestaurantsRepository,
    {
      provide: 'MenuCache',
      useFactory: async (config: ConfigService): Promise<MenuCache> => {
        const provider = config.get<'memory' | 'redis'>('CACHE_PROVIDER', 'memory');
        if (provider === 'redis') {
          const url = config.get<string>('REDIS_URL');
          if (!url) {
            throw new Error('REDIS_URL is required when CACHE_PROVIDER=redis');
          }
          const prefix = config.get<string>('REDIS_KEY_PREFIX') ?? 'se';
          type RedisCacheModule = {
            RedisMenuCache: new (
              url: string,
              prefix?: string,
            ) => MenuCache & { connect(): Promise<void> };
          };
          const mod = (await import('./cache/redis-menu-cache')) as RedisCacheModule;
          const cache = new mod.RedisMenuCache(url, prefix);
          await cache.connect();
          return cache;
        }
        return new InMemoryMenuCache();
      },
      inject: [ConfigService],
    },
  ],
})
export class RestaurantsModule {}
