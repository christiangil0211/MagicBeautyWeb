import { Component, DestroyRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  HOME_SLIDES,
  HOME_SLIDE_INTERVAL_MS,
  HOME_SLIDE_SIZES,
  HomeSlide,
  homeSlideSrcset,
  orderHomeSlides
} from './home-slides';
import { PortalBanner } from './portal-navigation';

/**
 * Carrusel de campañas a todo el ancho bajo la cabecera, en todas las páginas con
 * banner, seguido del h1 fijo de la página (nunca depende del banner a la vista).
 * Lo usan el portal público y la tienda con sesión, así ambos se ven igual.
 *
 * Accesibilidad: rota solo, pero se detiene con el mouse encima, con el foco del
 * teclado dentro, con "reducir movimiento" o con el botón de pausa (WCAG 2.2.2).
 * Los controles viven fuera de la diapositiva para que el foco no se pierda al
 * cambiar de banner, y el texto bajo la imagen reserva el alto del más largo para
 * que cambiar de banner no mueva la página.
 */
@Component({
  selector: 'app-portal-banner',
  imports: [RouterLink],
  templateUrl: './portal-banner.component.html',
  styleUrl: './portal-banner.component.scss'
})
export class PortalBannerComponent {
  readonly banner = input<PortalBanner | null>(null);

  /**
   * Orden del código en el primer render (igual en el HTML prerenderizado y al
   * hidratar); en el navegador se ajusta a la temporada vigente.
   */
  readonly slides = signal<readonly HomeSlide[]>(HOME_SLIDES);
  readonly activeSlide = signal(0);
  readonly current = computed(() => this.slides()[this.activeSlide()]);
  readonly sizes = HOME_SLIDE_SIZES;
  readonly srcset = homeSlideSrcset;

  readonly bannerHovered = signal(false);
  /** Solo pausa el foco con teclado: un clic en un control no debe detener la rotación. */
  readonly bannerKeyboardFocus = signal(false);
  /** Pausa elegida por la persona (o "reducir movimiento" del sistema). */
  readonly userPaused = signal(false);
  readonly rotating = computed(() => !this.userPaused() && !this.bannerHovered() && !this.bannerKeyboardFocus());

  /** Momento del último cambio de banner; elegir uno a mano reinicia la cuenta. */
  private lastChange = Date.now();
  private swipeStartX: number | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const ordered = orderHomeSlides(HOME_SLIDES, new Date());
      if (ordered.some((slide, index) => slide.id !== this.slides()[index].id)) {
        this.slides.set(ordered);
        this.activeSlide.set(0);
      }

      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) this.userPaused.set(true);

      // Precarga los demás banners (en el tamaño que usará esta pantalla) para que
      // el cambio no muestre un hueco.
      this.slides().slice(1).forEach(slide => {
        const image = new Image();
        image.sizes = HOME_SLIDE_SIZES;
        image.srcset = homeSlideSrcset(slide);
        image.src = slide.image;
      });
      const timer = window.setInterval(() => {
        if (!this.banner() || !this.rotating() || document.hidden) {
          this.lastChange = Date.now();
          return;
        }
        if (Date.now() - this.lastChange >= HOME_SLIDE_INTERVAL_MS) this.showSlide(this.activeSlide() + 1);
      }, 500);
      destroyRef.onDestroy(() => window.clearInterval(timer));
    });
  }

  showSlide(index: number): void {
    const count = this.slides().length;
    this.activeSlide.set(((index % count) + count) % count);
    this.lastChange = Date.now();
  }

  previous(): void {
    this.showSlide(this.activeSlide() - 1);
  }

  next(): void {
    this.showSlide(this.activeSlide() + 1);
  }

  togglePause(): void {
    this.userPaused.update(paused => !paused);
    this.lastChange = Date.now();
  }

  onCarouselFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    this.bannerKeyboardFocus.set(!!target?.matches?.(':focus-visible'));
  }

  onCarouselFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !(event.currentTarget as HTMLElement).contains(next)) this.bannerKeyboardFocus.set(false);
  }

  /** Deslizar con el dedo cambia de banner (sin interferir con el scroll vertical). */
  onSwipeStart(event: PointerEvent): void {
    this.swipeStartX = event.pointerType === 'mouse' ? null : event.clientX;
  }

  onSwipeEnd(event: PointerEvent): void {
    if (this.swipeStartX === null) return;
    const distance = event.clientX - this.swipeStartX;
    this.swipeStartX = null;
    if (Math.abs(distance) > 40) this.showSlide(this.activeSlide() + (distance < 0 ? 1 : -1));
  }
}
