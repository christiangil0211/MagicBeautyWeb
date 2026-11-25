import { Component, DestroyRef, afterNextRender, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HOME_SLIDES, HOME_SLIDE_INTERVAL_MS } from './home-slides';
import { PortalBanner } from './portal-navigation';

/**
 * Banner a todo el ancho bajo la cabecera. Si el banner trae `campaignImage` es el
 * carrusel de campañas del inicio; si no, el banner de texto e imagen de la pestaña.
 * Lo usan el portal público y la tienda con sesión, así ambos se ven igual.
 */
@Component({
  selector: 'app-portal-banner',
  imports: [RouterLink],
  templateUrl: './portal-banner.component.html',
  styleUrl: './portal-banner.component.scss'
})
export class PortalBannerComponent {
  readonly banner = input<PortalBanner | null>(null);
  /** Un botón sin enlace pide ir al contenido de la página, bajo el banner. */
  readonly contentRequested = output<void>();

  readonly slides = HOME_SLIDES;
  readonly activeSlide = signal(0);
  readonly bannerHovered = signal(false);
  /** Solo pausa el foco con teclado: un clic en un punto no debe detener la rotación. */
  readonly bannerKeyboardFocus = signal(false);
  /** Momento del último cambio de banner; elegir uno a mano reinicia la cuenta. */
  private lastChange = Date.now();
  private swipeStartX: number | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      // Precarga los demás banners para que el cambio no muestre un hueco.
      this.slides.slice(1).forEach(slide => (new Image().src = slide.image));
      const timer = window.setInterval(() => {
        const paused = reducedMotion || this.bannerHovered() || this.bannerKeyboardFocus() || document.hidden;
        if (!this.banner()?.campaignImage || paused) {
          this.lastChange = Date.now();
          return;
        }
        if (Date.now() - this.lastChange >= HOME_SLIDE_INTERVAL_MS) this.showSlide(this.activeSlide() + 1);
      }, 500);
      destroyRef.onDestroy(() => window.clearInterval(timer));
    });
  }

  showSlide(index: number): void {
    const count = this.slides.length;
    this.activeSlide.set(((index % count) + count) % count);
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
