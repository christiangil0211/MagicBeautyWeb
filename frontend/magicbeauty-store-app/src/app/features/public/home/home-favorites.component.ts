import { Component, inject, signal } from '@angular/core';
import { timeout } from 'rxjs';

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
      title="Productos favoritos"
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
  readonly state = signal<HomeSectionState>('loading');
  readonly cards = signal<ProductCardModel[]>([]);

  constructor() {
    inject(CatalogService)
      .getProducts()
      .pipe(timeout({ first: HOME_API_TIMEOUT_MS }))
      .subscribe({
        next: products => {
          this.cards.set(pickHomeFavorites(products, colombiaDate(new Date())).map(toProductCard));
          this.state.set(this.cards().length > 0 ? 'ready' : 'fallback');
        },
        error: () => this.state.set('fallback')
      });
  }
}
