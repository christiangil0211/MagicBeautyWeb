import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BrandService } from '../../../core/services/brand.service';
import { PublicBrand } from '../../../shared/models/brand.model';

/**
 * Carrusel de logos de las marcas destacadas del inicio. Solo marcas activas,
 * destacadas y con logo: una marca sin logo no aparece. Es una fila que se
 * desliza (sin animación automática): se recorre con las flechas, con el dedo o
 * con Tab, y cada logo enlaza a /marcas/{slug}. Si no hay marcas, no se muestra.
 */
@Component({
  selector: 'app-home-brand-logos',
  imports: [RouterLink],
  template: `
    @if (logos().length > 0) {
      <section class="brand-logos" aria-labelledby="brand-logos-title">
        <header class="brand-logos__head">
          <h2 id="brand-logos-title" class="section-title">Nuestras marcas</h2>
          <a class="brand-logos__all" routerLink="/marcas">Ver todas <i class="pi pi-angle-right" aria-hidden="true"></i></a>
        </header>

        <div class="brand-logos__viewport">
          <button type="button" class="brand-logos__arrow brand-logos__arrow--prev" aria-label="Ver marcas anteriores" (click)="scroll(-1)">
            <i class="pi pi-angle-left" aria-hidden="true"></i>
          </button>
          <ul #track class="brand-logos__track">
            @for (brand of logos(); track brand.slug) {
              <li>
                <a class="brand-logo" [routerLink]="['/marcas', brand.slug]" [attr.aria-label]="'Ver productos de ' + brand.name">
                  <img [src]="brand.logoUrl" [alt]="'Logo de ' + brand.name" width="160" height="80" loading="lazy" decoding="async" />
                </a>
              </li>
            }
          </ul>
          <button type="button" class="brand-logos__arrow brand-logos__arrow--next" aria-label="Ver más marcas" (click)="scroll(1)">
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

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    // Si el API falla, la sección simplemente no aparece (queda debajo del
    // primer pantallazo, así que tampoco desplaza nada a la vista).
    inject(BrandService)
      .getPublicBrands()
      .subscribe({ next: brands => this.brands.set(brands), error: () => this.brands.set([]) });
  }

  scroll(direction: 1 | -1): void {
    const element = this.track()?.nativeElement;
    element?.scrollBy?.({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' });
  }
}
