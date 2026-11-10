import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { OrderDraftService } from '../../../core/services/order-draft.service';
import { PortalBannerService } from './portal-banner.service';
import { HOME_SLIDES, HOME_SLIDE_INTERVAL_MS } from './home-slides';
import { PORTAL_TABS, PortalBanner } from './portal-navigation';

/**
 * Contenedor del portal público: banner de la pestaña actual (a todo el ancho,
 * como el del inicio), las cuatro pestañas y su contenido. Las pestañas son
 * rutas hijas, así el pedido (un servicio raíz) se conserva al cambiar entre ellas.
 */
@Component({
  selector: 'app-portal-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './portal-shell.component.html',
  styleUrl: './portal-shell.component.scss'
})
export class PortalShellComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

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

  readonly tabs = PORTAL_TABS;
  readonly orderCount = inject(OrderDraftService).itemCount;

  /** Banner declarado en la ruta hija activa; el detalle de producto no tiene. */
  private readonly routeBanner = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.currentBanner())
    ),
    { initialValue: this.currentBanner() }
  );

  private readonly heading = inject(PortalBannerService).heading;

  /** El de la ruta, con el título propio de la página si lo declaró (una categoría). */
  readonly banner = computed<PortalBanner | null>(() => {
    const banner = this.routeBanner();
    const heading = this.heading();

    return banner && heading ? { ...banner, ...heading } : banner;
  });

  /** Botones sin enlace: llevan al contenido de la pestaña, bajo el banner. */
  scrollToContent(): void {
    this.content()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private currentBanner(): PortalBanner | null {
    let route = this.route.snapshot;

    while (route.firstChild) {
      route = route.firstChild;
    }

    return (route.data['portalBanner'] as PortalBanner | undefined) ?? null;
  }
}
