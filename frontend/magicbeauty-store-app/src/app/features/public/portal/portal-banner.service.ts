import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

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

/**
 * Banner de la ruta hija más profunda (`data.portalBanner`); el detalle de producto
 * no declara ninguno. Una página puede cambiar el título con PortalBannerService.
 * Debe llamarse en el contexto de inyección del componente que lo pinta.
 */
export function routeBanner() {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const heading = inject(PortalBannerService).heading;

  const current = (): PortalBanner | null => {
    let snapshot = route.snapshot;

    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
    }

    return (snapshot.data['portalBanner'] as PortalBanner | undefined) ?? null;
  };

  const fromRoute = toSignal(
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => current())
    ),
    { initialValue: current() }
  );

  return computed<PortalBanner | null>(() => {
    const banner = fromRoute();
    const title = heading();

    return banner && title ? { ...banner, ...title } : banner;
  });
}
