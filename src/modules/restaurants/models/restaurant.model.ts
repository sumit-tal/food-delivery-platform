/**
 * RestaurantModel represents a restaurant in the catalog.
 */
export interface RestaurantModel {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly cuisineTypes: readonly string[];
  readonly city: string;
  readonly area?: string;
  readonly isOpen: boolean;
  readonly rating?: number;
  readonly etaMin?: number;
  readonly etaMax?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * PublicRestaurant is a safe view for API responses.
 */
export interface PublicRestaurant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly cuisineTypes: readonly string[];
  readonly city: string;
  readonly area?: string;
  readonly isOpen: boolean;
  readonly rating?: number;
  readonly etaMin?: number;
  readonly etaMax?: number;
}
