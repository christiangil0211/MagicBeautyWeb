import { Component, OnInit, inject, input, signal } from '@angular/core';
import { timeout } from 'rxjs';

import { CatalogService } from '../../../core/services/catalog.service';
import { CategoryCarousel } from '../../../shared/models/category.model';
import { CatalogProductListItem, ProductCardModel, toProductCard } from '../../../shared/models/product.model';
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
 * el inicio (foto, precio detal y existencias) de la categoría y sus
 * subcategorías, en un orden que cambia cada día. Sin productos listos, la
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
export class HomeCategoryCarouselComponent implements OnInit {
  private readonly catalog = inject(CatalogService);

  readonly category = input.required<CategoryCarousel>();
  readonly state = signal<HomeSectionState | 'hidden'>('loading');
  readonly cards = signal<ProductCardModel[]>([]);

  ngOnInit(): void {
    this.catalog
      .getProducts({ categoryId: this.category().id })
      .pipe(timeout({ first: HOME_API_TIMEOUT_MS }))
      .subscribe({
        next: products => {
          const picked = pickCategoryProducts(products, colombiaDate(new Date()));
          this.cards.set(picked.map(toProductCard));
          this.state.set(picked.length > 0 ? 'ready' : 'hidden');
        },
        error: () => this.state.set('fallback')
      });
  }

  carouselState(): HomeSectionState {
    const state = this.state();
    return state === 'hidden' ? 'fallback' : state;
  }
}

/** Hasta 16 productos; con varias subcategorías, ninguna pasa de la mitad. */
export function pickCategoryProducts(products: readonly CatalogProductListItem[], seed: string): CatalogProductListItem[] {
  const groups = new Set(products.filter(isHomeReady).map(categoryGroup)).size;
  const perGroup = groups > 1 ? HOME_CATEGORY_PER_GROUP : HOME_FAVORITES_MAX;

  return pickHomeFavorites(products, seed, HOME_FAVORITES_MAX, perGroup);
}
