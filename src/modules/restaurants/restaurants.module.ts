import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsRepository } from './repositories/restaurants.repository';
import { PostgresRestaurantsRepository } from './repositories/postgres-restaurants.repository';
import { InMemoryMenuCache } from './cache/in-memory-menu-cache';
import { ConfigService } from '@nestjs/config';
import type { MenuCache } from './cache/menu-cache';

// Import entities
import { RestaurantEntity } from './entities/restaurant.entity';
import { MenuEntity } from './entities/menu.entity';
import { MenuItemEntity } from './entities/menu-item.entity';
import { MenuCategoryEntity } from './entities/menu-category.entity';

/**
 * RestaurantsModule bundles catalog components.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RestaurantEntity,
      MenuEntity,
      MenuItemEntity,
      MenuCategoryEntity
    ])
  ],
  controllers: [RestaurantsController],
  providers: [
    RestaurantsService,
    RestaurantsRepository,
    PostgresRestaurantsRepository,
    {
      provide: 'MenuCache',
      useFactory: async (config: ConfigService): Promise<MenuCache> => {
        const provider = config.get<'memory' | 'redis' | 'enhanced-redis'>('CACHE_PROVIDER', 'memory');
        
        if (provider === 'enhanced-redis') {
          const url = config.get<string>('REDIS_URL');
          if (!url) {
            throw new Error('REDIS_URL is required when CACHE_PROVIDER=enhanced-redis');
          }
          const prefix = config.get<string>('REDIS_KEY_PREFIX') ?? 'se';
          type EnhancedRedisCacheModule = {
            EnhancedRedisMenuCache: new (
              url: string,
              prefix?: string,
            ) => MenuCache & { connect(): Promise<void> };
          };
          const mod = (await import('./cache/enhanced-redis-menu-cache')) as EnhancedRedisCacheModule;
          const cache = new mod.EnhancedRedisMenuCache(url, prefix);
          await cache.connect();
          return cache;
        } else if (provider === 'redis') {
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
