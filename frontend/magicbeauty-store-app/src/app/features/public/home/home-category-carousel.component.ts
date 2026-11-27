import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, effect, inject, input, untracked } from '@angular/core';
import { timeout } from 'rxjs';

import { CatalogService } from '../../../core/services/catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { CategoryCarousel } from '../../../shared/models/category.model';
import { CatalogProductListItem, ProductCardModel, toProductCard } from '../../../shared/models/product.model';
import { priceAudienceState } from '../../../shared/utils/visible-price';
import { colombiaDate } from '../portal/home-slides';
import { HOME_FAVORITES_MAX, categoryGroup, isHomeReady, pickHomeFavorites } from './home-favorites';
import { HomeProductCarouselComponent } from './home-product-carousel.component';
import { HOME_API_TIMEOUT_MS, HomeSectionState } from './home-sections';

/**
 * Si la categoría tiene subcategorías con productos, ninguna se queda con más
 * de la mitad del carrusel; si todo es de una sola, se llena con esa.
 */
const HOME_CATEGORY_PER_GROUP = HOME_FAVORITES_MAX / 2;

/**
 * Carrusel de una categoría del inicio (se enciende en Admin › Categorías ›
 * "Carrusel en el inicio", en cualquier nivel). Muestra productos listos para
 * el inicio (foto, precio visible y existencias) de la categoría y sus
 * subcategorías, con los más vendidos primero. Sin productos listos, la
 * sección no aparece; si el API falla o tarda, muestra el respaldo.
 */
@Component({
  selector: 'app-home-category-carousel',
  // Sin productos listos no ocupa lugar (ni siquiera la separación de la sección).
  host: { '[style.display]': "state() === 'hidden' ? 'none' : null" },
  imports: [HomeProductCarouselComponent],
  template: `
    @if (state() !== 'hidden') {
      <app-home-product-carousel
        [title]="category().name"
        [allLink]="'/catalogo/categoria/' + category().slug"
        allLabel="Ver todo"
        [fallbackText]="'No pudimos mostrar los productos de ' + category().name + ' en este momento. Mira el catálogo completo o escríbenos.'"
        [state]="carouselState()"
        [cards]="cards()" />
    }
  `
})
export class HomeCategoryCarouselComponent {
  private readonly catalog = inject(CatalogService);
  private readonly audience = inject(AuthService).priceAudienceKey;

  readonly category = input.required<CategoryCarousel>();
  readonly state = priceAudienceState<HomeSectionState | 'hidden'>(this.audience, 'loading');
  readonly cards = priceAudienceState<ProductCardModel[]>(this.audience, []);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    effect(onCleanup => {
      const categoryId = this.category().id;
      const audience = this.audience();
      if (audience === 'checking') return;

      this.cards.set([]);
      this.state.set('loading');

      const subscription = untracked(() => this.catalog
        .getProducts({ categoryId, homeRanking: true })
        .pipe(timeout({ first: HOME_API_TIMEOUT_MS }))
        .subscribe({
          next: products => {
            if (this.audience() !== audience || this.category().id !== categoryId) return;

            const picked = pickCategoryProducts(products, colombiaDate(new Date()));
            this.cards.set(picked.map(toProductCard));
            this.state.set(picked.length > 0 ? 'ready' : 'hidden');
          },
          error: () => {
            if (this.audience() === audience && this.category().id === categoryId) this.state.set('fallback');
          }
        }));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  carouselState(): HomeSectionState {
    const state = this.state();
    return state === 'hidden' ? 'fallback' : state;
  }
}

/** Hasta 16 productos; con varias subcategorías, ninguna pasa de la mitad. */
export function pickCategoryProducts(products: readonly CatalogProductListItem[], seed: string): CatalogProductListItem[] {
  const ranked = products.filter(product => product.isBestSeller && isHomeReady(product));
  const remainder = products.filter(product => !product.isBestSeller);
  const groups = new Set(products.filter(isHomeReady).map(categoryGroup)).size;
  const perGroup = groups > 1 ? HOME_CATEGORY_PER_GROUP : HOME_FAVORITES_MAX;

  const fill = pickHomeFavorites(remainder, seed, HOME_FAVORITES_MAX, perGroup);
  return [...ranked, ...fill].slice(0, HOME_FAVORITES_MAX);
}
