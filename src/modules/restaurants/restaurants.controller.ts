import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseBoolPipe, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { APP_CONSTANTS } from '../../common/constants/app.constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpsertMenuDto } from './dto/upsert-menu.dto';
import type { PublicRestaurant } from './models/restaurant.model';
import type { MenuItemModel, MenuModel } from './models/menu.model';

/**
 * RestaurantsController exposes REST endpoints for the catalog.
 */
@Controller(`${APP_CONSTANTS.API_PREFIX}/${APP_CONSTANTS.API_VERSION}/restaurants`)
export class RestaurantsController {
  public constructor(private readonly service: RestaurantsService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  public create(@Body() dto: CreateRestaurantDto): PublicRestaurant {
    const data = {
      name: dto.name,
      cuisineTypes: dto.cuisineTypes,
      city: dto.city,
      area: dto.area,
      isOpen: dto.isOpen,
      rating: dto.rating,
      etaMin: dto.etaMin,
      etaMax: dto.etaMax
    } as const;
    return this.service.onboard(data);
  }

  @Get()
  public list(
    @Query('city') city?: string,
    @Query('cuisine') cuisine?: string,
    @Query('open', new ParseBoolPipe({ optional: true })) isOpen?: boolean,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ): { readonly items: readonly PublicRestaurant[]; readonly page: number; readonly limit: number } {
    const p = page && page > 0 ? page : 1;
    const l = limit && limit > 0 && limit <= 100 ? limit : 20;
    const items = this.service.list({ city, cuisine, isOpen, page: p, limit: l });
    return { items, page: p, limit: l };
  }

  @Get(':slug')
  public getBySlug(@Param('slug') slug: string): PublicRestaurant {
    return this.service.getDetailsBySlug(slug);
  }

  @Get(':slug/menu')
  @Header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120')
  public getMenu(@Param('slug') slug: string): Promise<MenuModel> {
    return this.service.getMenuBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.RESTAURANT_OWNER, UserRole.ADMIN)
  @Put(':slug/menu')
  public upsertMenu(@Param('slug') slug: string, @Body() dto: UpsertMenuDto): Promise<MenuModel> {
    const items: readonly MenuItemModel[] = dto.items.map(i => ({
      id: `${slug}-${i.name}`,
      restaurantId: '',
      name: i.name,
      description: i.description,
      priceCents: i.priceCents,
      currency: i.currency,
      isAvailable: i.isAvailable,
      tags: i.tags,
      imageUrl: i.imageUrl
    }));
    return this.service.upsertMenuBySlug(slug, items, dto.expectedVersion);
  }
}
