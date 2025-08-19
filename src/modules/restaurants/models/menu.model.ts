/**
 * Menu models capture the restaurant's offerings.
 */
export interface MenuItemModel {
  readonly id: string;
  readonly restaurantId: string;
  readonly name: string;
  readonly description?: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly isAvailable: boolean;
  readonly tags?: readonly string[];
  readonly imageUrl?: string;
}

export interface MenuModel {
  readonly restaurantId: string;
  readonly version: number;
  readonly items: readonly MenuItemModel[];
}
