import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { SEO_DEFAULTS, SeoRouteData } from './seo.model';
import { SeoService } from './seo.service';

/**
 * Aplica los metadatos de la ruta en cada navegación. Sustituye a la estrategia
 * de títulos del router para que título, descripción, robots y canonical salgan
 * del mismo sitio y en el mismo momento.
 *
 * El `data.seo` se acumula desde la raíz: un `noindex` en la ruta padre (el
 * administrador) cubre a todas sus hijas.
 */
@Injectable({ providedIn: 'root' })
export class SeoTitleStrategy extends TitleStrategy {
  private readonly seo = inject(SeoService);

  override updateTitle(state: RouterStateSnapshot): void {
    const data = collectSeoData(state.root);
    const [path, query = ''] = state.url.split('#')[0].split('?');
    const params = new URLSearchParams(query);
    const isInternalSearch = (data.noindexQueryParams ?? []).some(name => (params.get(name) ?? '').trim() !== '');

    this.seo.apply({
      title: this.buildTitle(state) ?? SEO_DEFAULTS.title,
      description: data.description,
      path: path || '/',
      noindex: data.noindex || isInternalSearch,
      jsonLd: data.jsonLd
    });
    this.seo.notifyNavigation();
  }
}

function collectSeoData(root: ActivatedRouteSnapshot): SeoRouteData {
  let merged: SeoRouteData = {};

  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    merged = { ...merged, ...(route.data['seo'] as SeoRouteData | undefined) };
  }

  return merged;
}
