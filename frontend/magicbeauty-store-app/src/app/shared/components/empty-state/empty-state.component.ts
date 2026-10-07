import { Component, input } from '@angular/core';

/**
 * Estado vacío o sin resultados: icono en círculo rosado, título y mensaje.
 * Las acciones (botón o enlace) se proyectan como contenido.
 */
@Component({
  selector: 'app-empty-state',
  template: `
    <span class="empty__icon" aria-hidden="true"><i [class]="'pi ' + icon()"></i></span>
    <strong class="empty__title">{{ title() }}</strong>
    @if (message()) {
      <p class="empty__message">{{ message() }}</p>
    }
    <div class="empty__actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      padding: 3rem 1rem;
      text-align: center;
    }

    :host(.empty--boxed) {
      border: 1px dashed var(--mb-border-pink);
      border-radius: var(--mb-radius);
      background: var(--mb-surface);
    }

    .empty__icon {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      margin-bottom: 0.4rem;
      border-radius: 50%;
      background: var(--mb-primary-soft);
      color: var(--mb-primary);

      i {
        font-size: 1.35rem;
      }
    }

    .empty__title {
      font-size: 1rem;
      color: var(--mb-heading);
    }

    .empty__message {
      max-width: 42ch;
      margin: 0;
      font-size: 0.88rem;
      color: var(--mb-text-muted);
    }

    .empty__actions:empty {
      display: none;
    }

    .empty__actions {
      margin-top: 0.75rem;
    }
  `,
  host: {
    '[class.empty--boxed]': 'boxed()'
  }
})
export class EmptyStateComponent {
  /** Clase de PrimeIcons sin el prefijo "pi", por ejemplo "pi-inbox". */
  readonly icon = input('pi-inbox');
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
  /** Con borde punteado y fondo blanco, para mostrarlo dentro de una sección. */
  readonly boxed = input(false);
}
