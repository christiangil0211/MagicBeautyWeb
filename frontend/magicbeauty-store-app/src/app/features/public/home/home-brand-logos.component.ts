import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BrandService } from '../../../core/services/brand.service';
import { PublicBrand } from '../../../shared/models/brand.model';
import { HomeCarouselAutoplay } from './home-carousel-autoplay';

/**
 * Carrusel de logos de las marcas destacadas del inicio. Solo marcas activas,
 * destacadas y con logo: una marca sin logo no aparece. Cada tarjeta muestra el
 * logo a color y el nombre, y enlaza a /marcas/{slug}. Avanza solo (con pausa)
 * y también se recorre con las flechas, con el dedo o con Tab. Si no hay
 * marcas, no se muestra.
 */
@Component({
  selector: 'app-home-brand-logos',
  imports: [RouterLink],
  template: `
    @if (logos().length > 0) {
      <section class="brand-logos" aria-labelledby="brand-logos-title">
        <header class="brand-logos__head">
          <h2 id="brand-logos-title" class="section-title">Nuestras marcas</h2>
          <div class="brand-logos__actions">
            @if (autoplay.allowed) {
              <button
                type="button"
                class="brand-logos__toggle"
                [attr.aria-label]="autoplay.paused() ? 'Reanudar el carrusel de marcas' : 'Pausar el carrusel de marcas'"
                [attr.aria-pressed]="autoplay.paused()"
                (click)="autoplay.togglePaused()">
                <i class="pi" [class.pi-play]="autoplay.paused()" [class.pi-pause]="!autoplay.paused()" aria-hidden="true"></i>
              </button>
            }
            <a class="brand-logos__all" routerLink="/marcas">Ver todas <i class="pi pi-angle-right" aria-hidden="true"></i></a>
          </div>
        </header>

        <div
          class="brand-logos__viewport"
          (mouseenter)="autoplay.hovering = true"
          (mouseleave)="autoplay.hovering = false"
          (focusin)="autoplay.focused = true"
          (focusout)="autoplay.focused = false"
          (pointerdown)="autoplay.touched()"
          (wheel)="autoplay.touched()">
          <button type="button" class="brand-logos__arrow brand-logos__arrow--prev" aria-label="Ver marcas anteriores" (click)="autoplay.scrollPage(-1)">
            <i class="pi pi-angle-left" aria-hidden="true"></i>
          </button>
          <ul #track class="brand-logos__track">
            @for (brand of logos(); track brand.slug) {
              <li>
                <a class="brand-logo" [routerLink]="['/marcas', brand.slug]" [attr.aria-label]="'Ver productos de ' + brand.name">
                  <span class="brand-logo__image">
                    <img [src]="brand.logoUrl" [alt]="'Logo de ' + brand.name" width="160" height="80" loading="lazy" decoding="async" />
                  </span>
                  <span class="brand-logo__name">{{ brand.name }}</span>
                </a>
              </li>
            }
          </ul>
          <button type="button" class="brand-logos__arrow brand-logos__arrow--next" aria-label="Ver más marcas" (click)="autoplay.scrollPage(1)">
            <i class="pi pi-angle-right" aria-hidden="true"></i>
          </button>
        </div>
      </section>
    }
  `,
  styleUrl: './home-brand-logos.component.scss'
})
export class HomeBrandLogosComponent {
  private readonly brands = signal<PublicBrand[]>([]);
  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  /** Destacadas, activas (el API solo entrega activas) y con logo. */
  readonly logos = computed(() => this.brands().filter(brand => brand.isFeatured && !!brand.logoUrl));

  /** Avanza solo una marca cada pocos segundos (ver HomeCarouselAutoplay). */
  readonly autoplay = new HomeCarouselAutoplay(() => this.track()?.nativeElement);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    // Si el API falla, la sección simplemente no aparece (queda debajo del
    // primer pantallazo, así que tampoco desplaza nada a la vista).
    inject(BrandService)
      .getPublicBrands()
      .subscribe({ next: brands => this.brands.set(brands), error: () => this.brands.set([]) });
  }
}
