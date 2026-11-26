import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { whatsappUrl } from '../../../core/constants/store-contact';

/**
 * Respaldo estático de una sección del inicio cuando el API falla o tarda:
 * ocupa el lugar de la sección (sin colapsarla, así la página no salta) y deja
 * a la clienta dos caminos que no dependen del API: el catálogo y WhatsApp.
 */
@Component({
  selector: 'app-home-fallback',
  imports: [RouterLink],
  template: `
    <p class="fallback__title">{{ title() }}</p>
    @if (text()) {
      <p class="fallback__text">{{ text() }}</p>
    }
    <div class="fallback__actions">
      <a class="fallback__button" routerLink="/catalogo">
        <i class="pi pi-shopping-cart" aria-hidden="true"></i> Ver catálogo
      </a>
      <a class="fallback__button fallback__button--outline" [href]="whatsappHref" target="_blank" rel="noopener noreferrer">
        <i class="pi pi-whatsapp" aria-hidden="true"></i> Escríbenos
      </a>
    </div>
  `,
  styleUrl: './home-fallback.component.scss',
  host: { role: 'status' }
})
export class HomeFallbackComponent {
  readonly title = input('Explora nuestro catálogo');
  readonly text = input<string | null>(null);

  readonly whatsappHref = whatsappUrl();
}
