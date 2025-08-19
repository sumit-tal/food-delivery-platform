import type { MenuCache } from './menu-cache';
import type { MenuModel } from '../models/menu.model';

interface RedisLikeMulti {
  set(key: string, value: string): RedisLikeMulti;
  exec(): Promise<unknown>;
}

interface RedisLikeClient {
  connect(): Promise<void>;
  quit(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  del(key: string): Promise<number>;
  multi(): RedisLikeMulti;
}

/**
 * RedisMenuCache implements MenuCache using Redis with versioned keys.
 * Keys:
 * - <prefix>:menu:<restaurantId>:latest => version number
 * - <prefix>:menu:<restaurantId>:v:<version> => serialized MenuModel
 */
export class RedisMenuCache implements MenuCache {
  private readonly url: string;
  private readonly prefix: string;
  private client: RedisLikeClient | null = null;

  public constructor(url: string, prefix?: string) {
    this.url = url;
    this.prefix = prefix ?? 'se';
  }

  /** Connect lazily to Redis */
  public async connect(): Promise<void> {
    if (this.client) {
      return;
    }
    const mod = (await import('redis')) as unknown as { createClient: (opts: { url: string }) => RedisLikeClient };
    const client = mod.createClient({ url: this.url });
    await client.connect();
    this.client = client;
  }

  public async getLatest(restaurantId: string): Promise<MenuModel | null> {
    await this.ensureClient();
    const c = this.client!;
    const latestKey = this.keyLatest(restaurantId);
    const versionStr = await c.get(latestKey);
    if (!versionStr) {
      return null;
    }
    const version = parseInt(versionStr, 10);
    if (Number.isNaN(version)) {
      return null;
    }
    const menuKey = this.keyVersion(restaurantId, version);
    const json = await c.get(menuKey);
    return json ? (JSON.parse(json) as MenuModel) : null;
  }

  public async set(menu: MenuModel): Promise<void> {
    await this.ensureClient();
    const c = this.client!;
    const menuKey = this.keyVersion(menu.restaurantId, menu.version);
    const latestKey = this.keyLatest(menu.restaurantId);
    const multi = c.multi();
    multi.set(menuKey, JSON.stringify(menu));
    multi.set(latestKey, String(menu.version));
    await multi.exec();
  }

  public async invalidate(restaurantId: string): Promise<void> {
    await this.ensureClient();
    const c = this.client!;
    await c.del(this.keyLatest(restaurantId));
  }

  private async ensureClient(): Promise<void> {
    if (!this.client) {
      await this.connect();
    }
  }

  private keyLatest(restaurantId: string): string {
    return `${this.prefix}:menu:${restaurantId}:latest`;
    }

  private keyVersion(restaurantId: string, version: number): string {
    return `${this.prefix}:menu:${restaurantId}:v:${version}`;
  }
}
