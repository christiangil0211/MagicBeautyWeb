import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';

/** Cada cuánto avanza solo un carrusel del inicio. */
export const HOME_CAROUSEL_AUTOPLAY_MS = 5_000;

/** Tras tocar, deslizar o usar las flechas, espera esto antes de volver a avanzar solo. */
export const HOME_CAROUSEL_RESUME_MS = 10_000;

/**
 * Avance automático de los carruseles del inicio (favoritos y marcas): un
 * elemento cada pocos segundos y, al final, vuelve al inicio. Se detiene con el
 * mouse encima, con el foco del teclado dentro, un rato después de tocarlo o
 * deslizarlo, con la pestaña oculta o con el botón de pausa. Si el equipo pide
 * reducir el movimiento (o no hay navegador), no avanza solo: `allowed` es
 * false y el componente no muestra el botón de pausa.
 *
 * Se crea en el constructor del componente (usa inject). `track` entrega el
 * carril que se desplaza; sus hijos directos son los elementos del carrusel.
 */
export class HomeCarouselAutoplay {
  readonly allowed: boolean;
  readonly paused = signal(false);

  hovering = false;
  focused = false;
  private lastTouch = 0;

  constructor(private readonly track: () => HTMLElement | undefined) {
    this.allowed =
      isPlatformBrowser(inject(PLATFORM_ID)) &&
      typeof matchMedia === 'function' &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.allowed) {
      const timer = setInterval(() => this.advance(), HOME_CAROUSEL_AUTOPLAY_MS);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }

  togglePaused(): void {
    this.paused.update(paused => !paused);
  }

  /** La persona movió el carrusel (dedo, rueda o flechas): espera antes de seguir solo. */
  touched(): void {
    this.lastTouch = Date.now();
  }

  /** Flechas: avanza o retrocede casi un ancho visible. */
  scrollPage(direction: 1 | -1): void {
    this.touched();
    const element = this.track();
    element?.scrollBy?.({ left: direction * element.clientWidth * 0.9, behavior: 'smooth' });
  }

  /** Un paso automático: un elemento, y al final vuelve al inicio. */
  private advance(): void {
    if (this.paused() || this.hovering || this.focused || document.hidden) return;
    if (Date.now() - this.lastTouch < HOME_CAROUSEL_RESUME_MS) return;

    const element = this.track();
    const item = element?.firstElementChild;
    if (!element || !item || !element.scrollTo) return;

    // Si todo cabe en pantalla, no hay nada que mover.
    if (element.scrollWidth <= element.clientWidth + 4) return;

    const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 4;
    const step = item.getBoundingClientRect().width + (parseFloat(getComputedStyle(element).columnGap) || 0);

    element.scrollTo({ left: atEnd ? 0 : element.scrollLeft + step, behavior: 'smooth' });
  }
}
