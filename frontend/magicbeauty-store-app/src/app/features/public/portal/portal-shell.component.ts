import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { OrderDraftService } from '../../../core/services/order-draft.service';
import { routeBanner } from './portal-banner.service';
import { PortalBannerComponent } from './portal-banner.component';
import { PORTAL_TABS } from './portal-navigation';

/**
 * Contenedor del portal público: banner de la pestaña actual (a todo el ancho,
 * como el del inicio), las cuatro pestañas y su contenido. Las pestañas son
 * rutas hijas, así el pedido (un servicio raíz) se conserva al cambiar entre ellas.
 */
@Component({
  selector: 'app-portal-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PortalBannerComponent],
  templateUrl: './portal-shell.component.html',
  styleUrl: './portal-shell.component.scss'
})
export class PortalShellComponent {
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  readonly tabs = PORTAL_TABS;
  readonly orderCount = inject(OrderDraftService).itemCount;

  /** Banner declarado en la ruta hija activa (con el título propio de la página si lo hay). */
  readonly banner = routeBanner();

  /** Botones sin enlace: llevan al contenido de la pestaña, bajo el banner. */
  scrollToContent(): void {
    this.content()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
