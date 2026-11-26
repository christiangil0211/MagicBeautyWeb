import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { timeout } from 'rxjs';

import { CatalogService } from '../../../core/services/catalog.service';
import { OrderDraftService } from '../../../core/services/order-draft.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { ProductCardModel, toProductCard } from '../../../shared/models/product.model';
import { colombiaDate } from '../portal/home-slides';
import { pickHomeFavorites } from './home-favorites';
import { HomeFallbackComponent } from './home-fallback.component';
import { HOME_API_TIMEOUT_MS, HomeSectionState } from './home-sections';

/**
 * "Productos favoritos" del inicio. El inicio lo carga diferido (al acercarse a
 * la pantalla), así el listado del catálogo no compite con la imagen principal.
 * Las tarjetas se comportan como en el catálogo digital: "Agregar" va al pedido.
 */
@Component({
  selector: 'app-home-favorites',
  imports: [RouterLink, ProductCardComponent, LoaderComponent, HomeFallbackComponent],
  styleUrl: './home-favorites.component.scss',
  template: `
    <header class="favorites__head">
      <div>
        <p class="favorites__eyebrow">Lo más amado <i class="pi pi-heart-fill" aria-hidden="true"></i></p>
        <h2 class="section-title">Productos favoritos</h2>
      </div>
      <a class="favorites__all" routerLink="/catalogo">Ver todos <i class="pi pi-angle-right" aria-hidden="true"></i></a>
    </header>

    @switch (state()) {
      @case ('loading') {
        <app-loader message="Cargando productos…" [compact]="true" />
      }
      @case ('fallback') {
        <app-home-fallback
          class="favorites__fallback"
          text="No pudimos mostrar los favoritos en este momento. Mira el catálogo completo o escríbenos." />
      }
      @default {
        <div class="favorites__grid">
          @for (product of cards(); track product.id) {
            <app-product-card
              [product]="product"
              [detailLink]="['/catalogo', product.reference]"
              addLabel="Agregar a cotización"
              [ignoreStock]="true"
              [showFavorite]="false"
              [showReference]="true"
              priceLayout="columns"
              (addToCart)="onAddToCart($event)"
              (chooseVariant)="onChooseVariant($event)" />
          }
        </div>
      }
    }
  `
})
export class HomeFavoritesComponent {
  private readonly orderDraft = inject(OrderDraftService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  /**
   * Nunca colapsa: si el API falla, tarda o no hay productos listos para el
   * inicio, muestra el respaldo en el mismo alto reservado (sin salto).
   */
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

  onAddToCart(product: ProductCardModel): void {
    this.orderDraft.add({
      productId: product.id,
      reference: product.reference,
      name: product.name,
      brandName: product.brandName,
      imageUrl: product.mainImageUrl ?? null,
      variantId: null,
      variantName: null
    });

    this.messageService.add({
      severity: 'success',
      summary: 'Agregado a tu pedido',
      detail: product.name + ' ya está en Mi pedido.'
    });
  }

  /** Los tonos se eligen en la ficha del producto. */
  onChooseVariant(product: ProductCardModel): void {
    this.router.navigate(['/catalogo', product.reference]);
  }
}
