import { Component, input } from '@angular/core';

/**
 * Encabezado de página del administrador: antetítulo, título y subtítulo a la
 * izquierda; indicadores y acciones (contenido proyectado) a la derecha.
 */
@Component({
  selector: 'app-page-header',
  template: `
    <div class="page-header__text">
      @if (eyebrow()) {
        <p class="mb-eyebrow">{{ eyebrow() }}</p>
      }
      <h1 class="mb-page-title">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="mb-subtitle">{{ subtitle() }}</p>
      }
    </div>
    <div class="page-header__actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1.25rem;
    }

    .page-header__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    .page-header__actions:empty {
      display: none;
    }

    @media (max-width: 900px) {
      .page-header__actions {
        width: 100%;
        justify-content: space-between;
      }
    }
  `
})
export class PageHeaderComponent {
  readonly eyebrow = input<string | null>(null);
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
