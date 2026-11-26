import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { timeout } from 'rxjs';

import { CategoryService } from '../../../core/services/category.service';
import { CategoryCarousel } from '../../../shared/models/category.model';
import { HomeCategoryCarouselComponent } from './home-category-carousel.component';
import { HOME_API_TIMEOUT_MS } from './home-sections';

/**
 * Carruseles de categorías del inicio, uno debajo del otro, en el orden de las
 * categorías (máximo 5, lo valida el API). Se encienden en Admin › Categorías.
 * Cada uno carga sus productos solo al acercarse a la pantalla. Si no hay
 * ninguno encendido o el API falla, no aparece nada (están debajo del primer
 * pantallazo, así que tampoco desplazan nada a la vista).
 */
@Component({
  selector: 'app-home-category-carousels',
  imports: [HomeCategoryCarouselComponent],
  template: `
    @for (category of carousels(); track category.id) {
      @defer (on viewport) {
        <app-home-category-carousel class="category-carousels__item" [category]="category" />
      } @placeholder {
        <section class="category-carousels__item category-carousels__item--placeholder" aria-hidden="true"></section>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    /* Mismo ancho y separación que las demás secciones del inicio (.home-section). */
    .category-carousels__item {
      display: block;
      width: calc(100% - var(--mb-gutter) * 2);
      max-width: var(--mb-container);
      margin: 0 auto;
      padding-top: 3.5rem;
    }

    /* Reserva el alto del carrusel mientras no se ha cargado. */
    .category-carousels__item--placeholder {
      min-height: 520px;
    }

    @media (max-width: 640px) {
      .category-carousels__item {
        width: 100%;
        padding-top: 2.25rem;
      }

      .category-carousels__item--placeholder {
        min-height: 470px;
      }
    }
  `
})
export class HomeCategoryCarouselsComponent {
  readonly carousels = signal<CategoryCarousel[]>([]);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    inject(CategoryService)
      .getHomeCarousels()
      .pipe(timeout({ first: HOME_API_TIMEOUT_MS }))
      .subscribe({ next: carousels => this.carousels.set(carousels), error: () => this.carousels.set([]) });
  }
}
