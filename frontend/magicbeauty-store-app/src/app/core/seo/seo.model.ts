import { STORE_CONTACT, STORE_SITE_URL } from '../constants/store-contact';

/** Un bloque JSON-LD por clave: la clave identifica el <script> para poder reemplazarlo. */
export type JsonLdMap = Record<string, object>;

/** Todo lo que una página declara para buscadores y vistas previas de enlaces. */
export interface SeoPage {
  title: string;
  description?: string;
  /** Ruta canónica, p. ej. `/catalogo`. No se emite en páginas `noindex`. */
  path?: string;
  noindex?: boolean;
  /** Imagen de la vista previa: ruta del sitio o URL absoluta. */
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'product';
  jsonLd?: JsonLdMap;
}

/** Lo que una ruta declara en `data.seo`; el título sale del `title` de la ruta. */
export interface SeoRouteData {
  description?: string;
  noindex?: boolean;
  /** La página deja de indexarse si la URL trae alguno de estos parámetros (búsquedas internas). */
  noindexQueryParams?: string[];
  jsonLd?: JsonLdMap;
}

export const SEO_DEFAULTS = {
  title: 'Magic Beauty Cosmetics | Maquillaje y cosméticos en Cali, al detal y al por mayor',
  description:
    'Magic Beauty Cosmetics: tienda de maquillaje, cosméticos y productos capilares, faciales y corporales en Cali, Colombia. Venta al detal y al por mayor.',
  image: '/images/og-magic-beauty.jpg',
  imageAlt: STORE_CONTACT.businessName,
  locale: 'es_CO'
} as const;

/** Convierte una ruta del sitio en URL absoluta sobre el dominio canónico. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return STORE_SITE_URL + (pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl);
}

/**
 * Marca que se puede publicar en metadatos. "Sin marca" es el comodín del
 * catálogo para productos sin marca: no se anuncia como si fuera una.
 */
export function publicBrandName(brandName: string | null | undefined): string | null {
  const name = brandName?.trim() ?? '';

  return name && name.toLowerCase() !== 'sin marca' ? name : null;
}

/** Recorta un texto a lo que cabe en una metadescripción, sin partir palabras. */
export function toMetaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();

  if (clean.length <= max) {
    return clean;
  }

  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');

  return (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:]+$/, '') + '…';
}
