import { Injectable, signal } from '@angular/core';

import { PortalBanner } from './portal-navigation';

/**
 * Título propio para el banner de la página actual. El banner sale de la ruta,
 * pero una página puede necesitar su propio encabezado (la de una categoría):
 * lo deja aquí y el portal lo pinta en lugar del título de la ruta.
 */
@Injectable({ providedIn: 'root' })
export class PortalBannerService {
  readonly heading = signal<Pick<PortalBanner, 'title' | 'highlight'> | null>(null);
}
