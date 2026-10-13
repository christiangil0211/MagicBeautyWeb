import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Página para direcciones que no existen. La ruta la marca `noindex`: el
 * hosting estático responde 200 a cualquier URL, así que es la página la que
 * le dice a los buscadores que aquí no hay contenido.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="not-found">
      <span class="not-found__icon" aria-hidden="true"><i class="pi pi-search"></i></span>
      <h1>No encontramos esta página</h1>
      <p>Puede que el enlace haya cambiado o que la dirección esté mal escrita.</p>
      <div class="not-found__actions">
        <a class="mb-btn" routerLink="/catalogo">Ver el catálogo digital</a>
        <a class="mb-btn mb-btn--ghost" routerLink="/">Ir al inicio</a>
      </div>
    </section>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      max-width: var(--mb-container);
      margin: 0 auto;
      padding: 4rem var(--mb-gutter);
      text-align: center;
    }

    .not-found__icon {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--mb-primary-soft);
      color: var(--mb-primary);

      i {
        font-size: 1.35rem;
      }
    }

    h1 {
      margin: 0.4rem 0 0;
      font-size: 1.5rem;
      color: var(--mb-heading);
    }

    p {
      margin: 0;
      color: var(--mb-text-secondary);
    }

    .not-found__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 1rem;
    }
  `
})
export class NotFoundComponent {}
