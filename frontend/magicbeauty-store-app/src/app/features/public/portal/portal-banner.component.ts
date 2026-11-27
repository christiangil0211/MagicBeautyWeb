import { Component, DestroyRef, afterNextRender, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { HomeBannerStore } from './home-banner-store';
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
 *
 * Banners: el HTML prerenderizado lleva los de respaldo (HOME_SLIDES); en el
 * navegador se reemplazan por los de Admin › Banners del inicio si hay alguno
 * visible. El administrador usa `preview` para ver su borrador sin pedir nada.
 */
@Component({
  selector: 'app-portal-banner',
  imports: [RouterLink],
  templateUrl: './portal-banner.component.html',
  styleUrl: './portal-banner.component.scss'
})
export class PortalBannerComponent {
  readonly banner = input<PortalBanner | null>(null);

  /** Vista previa del administrador: estos banners, sin consultar el API. */
  readonly preview = input<readonly HomeSlide[] | null>(null);

  /** Vista previa: id del banner que se está editando; el carrusel salta a él. */
  readonly previewFocus = input<string | null>(null);

  /** El administrador oculta el h1 de la página en su vista previa. */
  readonly showHeading = input(true);

  /**
   * Orden del código en el primer render (igual en el HTML prerenderizado y al
   * hidratar); en el navegador se ajusta a la temporada vigente y luego a los
   * banners del administrador.
   */
  private readonly liveSlides = signal<readonly HomeSlide[]>(HOME_SLIDES);
  readonly slides = computed(() => {
    const preview = this.preview();
    return preview?.length ? preview : this.liveSlides();
  });
  readonly activeSlide = signal(0);
  readonly current = computed(() => this.slides()[Math.min(this.activeSlide(), this.slides().length - 1)]);
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
    const store = inject(HomeBannerStore);

    // Si la lista cambia (llegan los del API o se edita la vista previa), el
    // banner a la vista se conserva si sigue en ella; si no, vuelve al primero.
    let previousIds: string[] = [];
    effect(() => {
      const ids = this.slides().map(slide => slide.id);
      untracked(() => {
        const currentId = previousIds[this.activeSlide()];
        const index = currentId ? ids.indexOf(currentId) : -1;
        if (index !== this.activeSlide()) this.activeSlide.set(Math.max(index, 0));
        previousIds = ids;
      });
    });

    effect(() => {
      const focus = this.previewFocus();
      const index = focus ? this.slides().findIndex(slide => slide.id === focus) : -1;
      if (index >= 0) untracked(() => this.showSlide(index));
    });

    afterNextRender(() => {
      const ordered = orderHomeSlides(HOME_SLIDES, new Date());
      if (ordered.some((slide, index) => slide.id !== this.liveSlides()[index].id)) {
        this.liveSlides.set(ordered);
      }

      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) this.userPaused.set(true);

      if (!this.preview()) {
        store
          .slides()
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe(slides => {
            if (slides.length === 0) return;
            this.liveSlides.set(slides);
            this.preload(slides);
          });
      }

      this.preload(this.slides());
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

  /**
   * Precarga los demás banners (en el tamaño que usará esta pantalla) para que el
   * cambio no muestre un hueco.
   */
  private preload(slides: readonly HomeSlide[]): void {
    slides
      .filter(slide => slide.id !== this.current()?.id && slide.image)
      .forEach(slide => {
        const image = new Image();
        image.sizes = HOME_SLIDE_SIZES;
        image.srcset = homeSlideSrcset(slide);
        image.src = slide.image;
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
