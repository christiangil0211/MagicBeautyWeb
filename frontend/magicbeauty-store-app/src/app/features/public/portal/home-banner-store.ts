import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, timeout } from 'rxjs';

import { HomeBannerService } from '../../../core/services/home-banner.service';
import { HOME_API_TIMEOUT_MS } from '../home/home-sections';
import { HomeSlide, slideFromBanner } from './home-slides';

/**
 * Banners del carrusel que vienen del administrador. Se piden una vez por visita
 * (todas las páginas con banner comparten la respuesta). Si el API falla, tarda o
 * no hay ninguno visible, entrega una lista vacía y el carrusel conserva los de
 * respaldo (HOME_SLIDES).
 */
@Injectable({ providedIn: 'root' })
export class HomeBannerStore {
  private readonly service = inject(HomeBannerService);
  private request$?: Observable<readonly HomeSlide[]>;

  slides(): Observable<readonly HomeSlide[]> {
    this.request$ ??= this.service.getVisible().pipe(
      timeout({ first: HOME_API_TIMEOUT_MS }),
      map(banners => banners.filter(banner => !!banner.imageUrl).map(slideFromBanner)),
      catchError(() => of([])),
      shareReplay(1)
    );

    return this.request$;
  }

  /** Tras un cambio en el administrador: la próxima página con banner vuelve a preguntar. */
  refresh(): void {
    this.request$ = undefined;
  }
}
