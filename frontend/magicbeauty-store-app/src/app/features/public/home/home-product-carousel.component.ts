import { Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';

import { OrderDraftService } from '../../../core/services/order-draft.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { ProductCardModel } from '../../../shared/models/product.model';
import { HomeCarouselAutoplay } from './home-carousel-autoplay';
import { HomeFallbackComponent } from './home-fallback.component';
import { HomeSectionState } from './home-sections';

/**
 * Carrusel de productos del inicio ("Productos favoritos", "Cuidado capilar"…).
 * Solo presenta: quien lo usa carga los productos y pasa el estado. Las tarjetas
 * son las del catálogo digital ("Agregar" va al pedido). Avanza solo (con
 * pausa) y también se recorre con las flechas, con el dedo o con Tab. Nunca
 * colapsa: mientras carga o si falla, ocupa el mismo alto.
 */
@Component({
  selector: 'app-home-product-carousel',
  imports: [RouterLink, ProductCardComponent, LoaderComponent, HomeFallbackComponent],
  styleUrl: './home-product-carousel.component.scss',
  template: `
    <header class="carousel__head">
      <div>
        @if (eyebrow()) {
          <p class="carousel__eyebrow">
            {{ eyebrow() }}
            @if (eyebrowIcon()) {
              <i class="pi" [class]="eyebrowIcon()" aria-hidden="true"></i>
            }
          </p>
        }
        <h2 class="section-title">{{ title() }}</h2>
      </div>
      <div class="carousel__actions">
        @if (state() === 'ready' && autoplay.allowed) {
          <button
            type="button"
            class="carousel__toggle"
            [attr.aria-label]="(autoplay.paused() ? 'Reanudar el carrusel de ' : 'Pausar el carrusel de ') + title()"
            [attr.aria-pressed]="autoplay.paused()"
            (click)="autoplay.togglePaused()">
            <i class="pi" [class.pi-play]="autoplay.paused()" [class.pi-pause]="!autoplay.paused()" aria-hidden="true"></i>
          </button>
        }
        <a class="carousel__all" [routerLink]="allLink()">{{ allLabel() }} <i class="pi pi-angle-right" aria-hidden="true"></i></a>
      </div>
    </header>

    @switch (state()) {
      @case ('loading') {
        <app-loader message="Cargando productos…" [compact]="true" />
      }
      @case ('fallback') {
        <app-home-fallback class="carousel__fallback" [text]="fallbackText()" />
      }
      @default {
        <div
          class="carousel__viewport"
          (mouseenter)="autoplay.hovering = true"
          (mouseleave)="autoplay.hovering = false"
          (focusin)="autoplay.focused = true"
          (focusout)="autoplay.focused = false"
          (pointerdown)="autoplay.touched()"
          (wheel)="autoplay.touched()">
          <button type="button" class="carousel__arrow" aria-label="Ver productos anteriores" (click)="autoplay.scrollPage(-1)">
            <i class="pi pi-angle-left" aria-hidden="true"></i>
          </button>
          <ul #track class="carousel__track" [attr.aria-label]="title()">
            @for (product of cards(); track product.id) {
              <li>
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
              </li>
            }
          </ul>
          <button type="button" class="carousel__arrow" aria-label="Ver más productos" (click)="autoplay.scrollPage(1)">
            <i class="pi pi-angle-right" aria-hidden="true"></i>
          </button>
        </div>
      }
    }
  `
})
export class HomeProductCarouselComponent {
  private readonly orderDraft = inject(OrderDraftService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  readonly title = input.required<string>();
  readonly eyebrow = input<string | null>(null);
  /** Clase de PrimeIcons junto al texto pequeño de arriba (p. ej. 'pi-heart-fill'). */
  readonly eyebrowIcon = input<string | null>(null);
  readonly allLink = input<string>('/catalogo');
  readonly allLabel = input<string>('Ver todos');
  readonly fallbackText = input<string | null>(null);
  readonly state = input.required<HomeSectionState>();
  readonly cards = input<ProductCardModel[]>([]);

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  /** Avanza solo una tarjeta cada pocos segundos (ver HomeCarouselAutoplay). */
  readonly autoplay = new HomeCarouselAutoplay(() => this.track()?.nativeElement);

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
