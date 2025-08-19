import type { MenuCache } from './menu-cache';
import type { MenuModel } from '../models/menu.model';

/**
 * InMemoryMenuCache stores latest menu per restaurant with version.
 */
export class InMemoryMenuCache implements MenuCache {
  private readonly latest: Map<string, MenuModel> = new Map<string, MenuModel>();

  public getLatest(restaurantId: string): Promise<MenuModel | null> {
    const m = this.latest.get(restaurantId);
    return Promise.resolve(m ?? null);
  }

  public set(menu: MenuModel): Promise<void> {
    const current = this.latest.get(menu.restaurantId);
    if (!current || menu.version >= current.version) {
      this.latest.set(menu.restaurantId, menu);
    }
    return Promise.resolve();
  }

  public invalidate(restaurantId: string): Promise<void> {
    this.latest.delete(restaurantId);
    return Promise.resolve();
  }
}
