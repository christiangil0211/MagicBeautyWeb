import { Component } from '@angular/core';

import { whatsappUrl } from '../../../core/constants/store-contact';

/**
 * Botón flotante de WhatsApp, fijo en la esquina inferior izquierda.
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
      left: max(1.25rem, env(safe-area-inset-left));
      bottom: max(1.25rem, env(safe-area-inset-bottom));
      /* Debajo del overlay (20) y los paneles móviles (30). */
      z-index: 15;
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #25d366;
      color: #fff;
      box-shadow: var(--mb-shadow);
      text-decoration: none;
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease;

      i {
        font-size: 1.75rem;
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--mb-shadow-lg);
      }

      &:focus-visible {
        outline: 3px solid var(--mb-primary);
        outline-offset: 3px;
      }
    }

    @media (max-width: 640px) {
      .whatsapp {
        left: max(1rem, env(safe-area-inset-left));
        bottom: max(1rem, env(safe-area-inset-bottom));
        width: 50px;
        height: 50px;

        i {
          font-size: 1.55rem;
        }
      }
    }
  `
})
export class WhatsappButtonComponent {
  readonly href = whatsappUrl();
}
