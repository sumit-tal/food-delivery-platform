# Enhanced Caching Layer

This module provides a sophisticated caching implementation with advanced features to optimize system performance and reduce database load.

## Features

- **Time-based Expiration**: Configure TTL for different types of data
- **Staggered Expiration**: Prevents cache stampede by randomizing expiration times
- **Event-based Invalidation**: Invalidate cache entries based on events
- **Background Refresh**: Proactively refresh high-traffic cache entries before expiration
- **Versioned Cache Keys**: Support atomic updates with versioned keys
- **Cache Hit/Miss Monitoring**: Track cache performance metrics
- **Tag-based Invalidation**: Group related cache entries for bulk invalidation
- **Distributed Locking**: Prevent multiple concurrent generations of the same value

## Usage Examples

### Basic Usage

```typescript
import { EnhancedRedisCache } from '@common/cache/enhanced-redis-cache.service';

@Injectable()
export class MenuService {
  constructor(private readonly cache: EnhancedRedisCache<MenuModel>) {}

  async getMenu(restaurantId: string): Promise<MenuModel> {
    // Try to get from cache first, generate if not found
    return this.cache.getOrSet(
      `menu:${restaurantId}`,
      async () => {
        // This will only be called if the menu is not in cache
        return this.fetchMenuFromDatabase(restaurantId);
      },
      { ttl: 3600 } // 1 hour TTL
    );
  }
}
```

### Time-based Expiration

Configure different TTLs for different types of data:

```typescript
// Short TTL for frequently changing data
await cache.set('user:status', status, { ttl: 60 }); // 60 seconds

// Longer TTL for relatively static data
await cache.set('restaurant:info', info, { ttl: 86400 }); // 24 hours
```

### Staggered Expiration (Cache Stampede Prevention)

Prevent cache stampede by adding jitter to expiration times:

```typescript
await cache.set('popular:item', item, { 
  ttl: 3600, 
  useStaggeredExpiration: true 
});
```

### Event-based Invalidation

Invalidate cache entries when related data changes:

```typescript
// In your event handler
@OnEvent('menu.updated')
async handleMenuUpdated(payload: { restaurantId: string }) {
  // This will trigger cache invalidation
  this.eventEmitter.emit('cache.invalidate', { 
    key: `menu:${payload.restaurantId}` 
  });
}
```

### Background Refresh

Set up background refresh for high-traffic cache entries:

```typescript
await cache.set('trending:items', items, {
  ttl: 3600,
  backgroundRefresh: true,
  refreshPriority: 10, // Higher priority
  refreshFactory: async () => {
    return this.fetchTrendingItems();
  }
});
```

### Tag-based Invalidation

Group related cache entries with tags for bulk invalidation:

```typescript
// Store with tags
await cache.set('menu:item:1', item, {
  ttl: 3600,
  tags: ['menu', 'restaurant:123']
});

// Later, invalidate all menu-related cache entries
this.eventEmitter.emit('cache.invalidate', { 
  tags: ['menu'] 
});
```

### Cache Statistics

Monitor cache performance:

```typescript
const stats = cache.getStats();
console.log(`Cache hit ratio: ${stats.hitRatio * 100}%`);
console.log(`Average get time: ${stats.avgGetTime}ms`);
```

## Configuration

Register the cache module in your application:

```typescript
// In app.module.ts
import { CacheModule } from '@common/cache/cache.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      prefix: 'app'
    }),
    // ...other imports
  ],
})
export class AppModule {}
```

## Performance Considerations

- Use appropriate TTLs based on data volatility
- Enable background refresh for high-traffic cache entries
- Use tags to efficiently invalidate related cache entries
- Monitor cache hit/miss ratios to optimize caching strategy

## Best Practices

1. **Choose Appropriate TTLs**: Balance freshness vs. performance
2. **Use Tags Wisely**: Group related cache entries for efficient invalidation
3. **Enable Staggered Expiration**: For high-traffic cache keys to prevent stampedes
4. **Monitor Cache Statistics**: Regularly check hit ratios to optimize caching strategy
5. **Handle Cache Failures Gracefully**: Always have a fallback when cache is unavailable
