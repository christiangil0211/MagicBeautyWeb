import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { OrderDraftService } from '../../../core/services/order-draft.service';
import { PortalBannerService } from './portal-banner.service';
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
