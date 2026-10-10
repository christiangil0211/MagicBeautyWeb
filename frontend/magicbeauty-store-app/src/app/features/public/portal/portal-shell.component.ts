import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { OrderDraftService } from '../../../core/services/order-draft.service';
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
  readonly banner = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.currentBanner())
    ),
    { initialValue: this.currentBanner() }
  );

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
