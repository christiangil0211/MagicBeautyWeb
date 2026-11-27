import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { catchError, map, of, switchMap, timeout } from 'rxjs';

import { CatalogService } from '../../../core/services/catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProductCardModel, toProductCard } from '../../../shared/models/product.model';
import { priceAudienceState } from '../../../shared/utils/visible-price';
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
  private readonly audience = inject(AuthService).priceAudienceKey;
  readonly ranked = priceAudienceState(this.audience, false);
  readonly state = priceAudienceState<HomeSectionState>(this.audience, 'loading');
  readonly cards = priceAudienceState<ProductCardModel[]>(this.audience, []);

  constructor() {
    const catalog = inject(CatalogService);
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    effect(onCleanup => {
      const audience = this.audience();
      if (audience === 'checking') return;

      const subscription = untracked(() => catalog.getBestSellers().pipe(
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
          if (this.audience() !== audience) return;

          this.ranked.set(result.ranked);
          this.cards.set(result.products.map(toProductCard));
          this.state.set(result.products.length > 0 ? 'ready' : 'fallback');
        },
        error: () => {
          if (this.audience() === audience) this.state.set('fallback');
        }
      }));
      onCleanup(() => subscription.unsubscribe());
      });
  }
}
