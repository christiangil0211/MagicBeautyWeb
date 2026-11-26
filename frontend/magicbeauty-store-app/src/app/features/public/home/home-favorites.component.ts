import { Component, inject, signal } from '@angular/core';
import { catchError, map, of, switchMap, timeout } from 'rxjs';

import { CatalogService } from '../../../core/services/catalog.service';
import { ProductCardModel, toProductCard } from '../../../shared/models/product.model';
import { colombiaDate } from '../portal/home-slides';
import { pickHomeFavorites } from './home-favorites';
import { HomeProductCarouselComponent } from './home-product-carousel.component';
import { HOME_API_TIMEOUT_MS, HomeSectionState } from './home-sections';

/**
 * "Productos favoritos" del inicio. El inicio lo carga diferido (al acercarse a
 * la pantalla), así el listado del catálogo no compite con la imagen principal.
 * Nunca colapsa: si el API falla, tarda o no hay productos listos para el
 * inicio, muestra el respaldo en el mismo alto reservado (sin salto).
 */
@Component({
  selector: 'app-home-favorites',
  imports: [HomeProductCarouselComponent],
  template: `
    <app-home-product-carousel
      [title]="ranked() ? 'Más vendidos' : 'Productos favoritos'"
      eyebrow="Lo más amado"
      eyebrowIcon="pi-heart-fill"
      allLink="/catalogo"
      allLabel="Ver todos"
      fallbackText="No pudimos mostrar los favoritos en este momento. Mira el catálogo completo o escríbenos."
      [state]="state()"
      [cards]="cards()" />
  `
})
export class HomeFavoritesComponent {
  readonly ranked = signal(false);
  readonly state = signal<HomeSectionState>('loading');
  readonly cards = signal<ProductCardModel[]>([]);

  constructor() {
    const catalog = inject(CatalogService);
    catalog.getBestSellers().pipe(
      timeout({ first: HOME_API_TIMEOUT_MS }),
      catchError(() => of([])),
      switchMap(products => {
        if (products.length > 0) return of({ products, ranked: true });

        return catalog.getProducts().pipe(
          timeout({ first: HOME_API_TIMEOUT_MS }),
          map(items => ({ products: pickHomeFavorites(items, colombiaDate(new Date())), ranked: false }))
        );
      })
    ).subscribe({
        next: result => {
          this.ranked.set(result.ranked);
          this.cards.set(result.products.map(toProductCard));
          this.state.set(this.cards().length > 0 ? 'ready' : 'fallback');
        },
        error: () => this.state.set('fallback')
      });
  }
}
