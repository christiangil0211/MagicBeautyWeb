import { Component, input } from '@angular/core';

/**
 * Loader de MagicCuadre: el monograma de la marca en fucsia que late, con una
 * barra de progreso indeterminada y un mensaje.
 *
 * - inline: ocupa el espacio de la sección que carga (listados, fichas).
 * - overlay: cubre su contenedor posicionado con un velo blanco (operaciones).
 * - fullscreen: cubre toda la ventana.
 */
@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.scss',
  host: {
    role: 'status',
    'aria-live': 'polite',
    '[class.loader--inline]': "mode() === 'inline'",
    '[class.loader--overlay]': "mode() === 'overlay'",
    '[class.loader--fullscreen]': "mode() === 'fullscreen'",
    '[class.loader--compact]': 'compact()'
  }
})
export class LoaderComponent {
  readonly message = input<string | null>('Cargando…');
  readonly mode = input<'inline' | 'overlay' | 'fullscreen'>('inline');
  /** Versión pequeña para tarjetas o paneles estrechos. */
  readonly compact = input(false);
}
