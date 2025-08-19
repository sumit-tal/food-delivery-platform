/**
 * MenuCache abstracts menu caching with versioned entries.
 */
import type { MenuModel } from '../models/menu.model';

export interface MenuCache {
  getLatest(restaurantId: string): Promise<MenuModel | null>;
  set(menu: MenuModel): Promise<void>;
  invalidate(restaurantId: string): Promise<void>;
}
