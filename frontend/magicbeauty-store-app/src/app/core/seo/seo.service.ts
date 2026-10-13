import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { STORE_CONTACT } from '../constants/store-contact';
import { JsonLdMap, SEO_DEFAULTS, SeoPage, absoluteUrl } from './seo.model';

const JSON_LD_ATTRIBUTE = 'data-seo-jsonld';

/**
 * Metadatos de la página actual: título, descripción, robots, canonical, Open
 * Graph, Twitter Cards y JSON-LD. Cada llamada reemplaza por completo lo
 * anterior, así una página nunca hereda etiquetas de la que se visitó antes.
 *
 * Funciona igual en el navegador y en el prerenderizado: escribe sobre el
 * documento inyectado y arma las URL con el dominio canónico, no con `location`.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  private readonly navigationCount = signal(0);

  /**
   * Cambia en cada navegación, después de aplicar los metadatos de la ruta. Las
   * páginas con metadatos propios (producto, categoría) lo leen en su `effect`
   * para volver a aplicarlos encima de los de la ruta.
   */
  readonly navigation = this.navigationCount.asReadonly();

  /** La ruta ya aplicó sus metadatos por defecto: avisa a las páginas con datos propios. */
  notifyNavigation(): void {
    this.navigationCount.update(count => count + 1);
  }

  apply(page: SeoPage): void {
    const description = page.description ?? SEO_DEFAULTS.description;
    const canonical = page.noindex || !page.path ? null : absoluteUrl(page.path);
    const image = absoluteUrl(page.image ?? SEO_DEFAULTS.image);

    this.title.setTitle(page.title);
    this.setTag('name', 'description', description);
    this.setTag('name', 'robots', page.noindex ? 'noindex, follow' : 'index, follow');
    this.setCanonical(canonical);

    this.setTag('property', 'og:site_name', STORE_CONTACT.businessName);
    this.setTag('property', 'og:locale', SEO_DEFAULTS.locale);
    this.setTag('property', 'og:type', page.type ?? 'website');
    this.setTag('property', 'og:title', page.title);
    this.setTag('property', 'og:description', description);
    this.setTag('property', 'og:url', canonical);
    this.setTag('property', 'og:image', image);
    this.setTag('property', 'og:image:alt', page.imageAlt ?? SEO_DEFAULTS.imageAlt);

    this.setTag('name', 'twitter:card', 'summary_large_image');
    this.setTag('name', 'twitter:title', page.title);
    this.setTag('name', 'twitter:description', description);
    this.setTag('name', 'twitter:image', image);

    this.setJsonLd(page.noindex ? {} : (page.jsonLd ?? {}));
  }

  private setTag(attribute: 'name' | 'property', key: string, content: string | null): void {
    const selector = `${attribute}="${key}"`;

    if (content) {
      this.meta.updateTag({ [attribute]: key, content }, selector);
    } else {
      this.meta.removeTag(selector);
    }
  }

  private setCanonical(url: string | null): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!url) {
      link?.remove();
      return;
    }

    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }

    link.setAttribute('href', url);
  }

  private setJsonLd(blocks: JsonLdMap): void {
    const head = this.document.head;

    head.querySelectorAll(`script[${JSON_LD_ATTRIBUTE}]`).forEach(script => script.remove());

    for (const [key, data] of Object.entries(blocks)) {
      const script = this.document.createElement('script');

      script.setAttribute('type', 'application/ld+json');
      script.setAttribute(JSON_LD_ATTRIBUTE, key);
      // "<" escapado: un nombre de producto no puede cerrar la etiqueta <script>.
      script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
      head.appendChild(script);
    }
  }
}
