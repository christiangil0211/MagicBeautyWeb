import { Component } from '@angular/core';

import { whatsappUrl } from '../../../core/constants/store-contact';

/**
 * Botón flotante de WhatsApp, fijo en la esquina inferior derecha.
 * Queda por debajo de los overlays y paneles del layout para no tapar la navegación.
 */
@Component({
  selector: 'app-whatsapp-button',
  template: `
    <a
      class="whatsapp"
      [href]="href"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      title="Escríbenos por WhatsApp"
    >
      <i class="pi pi-whatsapp" aria-hidden="true"></i>
    </a>
  `,
  styles: `
    .whatsapp {
      position: fixed;
      right: max(1.25rem, env(safe-area-inset-right));
      bottom: max(1.25rem, env(safe-area-inset-bottom));
      /* Debajo del overlay (20) y los paneles móviles (30). */
      z-index: 15;
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      background: transparent;
      color: #25d366;
      text-decoration: none;
      transition:
        transform 0.2s ease,
        filter 0.2s ease;

      i {
        font-size: 3.5rem;
      }

      &:hover {
        transform: translateY(-2px);
        filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.15));
      }

      &:focus-visible {
        outline: 3px solid var(--mb-primary);
        outline-offset: 3px;
      }
    }

    @media (max-width: 640px) {
      .whatsapp {
        right: max(1rem, env(safe-area-inset-right));
        /* --mb-floating-offset: alto de una barra fija inferior (pestañas del portal). */
        bottom: calc(max(1rem, env(safe-area-inset-bottom)) + var(--mb-floating-offset, 0px));
        width: 60px;
        height: 60px;

        i {
          font-size: 3.25rem;
        }
      }
    }
  `
})
export class WhatsappButtonComponent {
  readonly href = whatsappUrl();
}
