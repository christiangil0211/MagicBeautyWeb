import {
  STORE_ADDRESS,
  STORE_CONTACT,
  STORE_GEO,
  STORE_OPENING_HOURS,
  STORE_SITE_URL,
  STORE_SOCIAL_LINKS
} from '../constants/store-contact';
import { PRICE_TYPE_CODES } from '../../shared/models/price-type.model';
import { ProductDetail } from '../../shared/models/product.model';
import { SEO_DEFAULTS, absoluteUrl, publicBrandName } from './seo.model';

const SCHEMA = 'https://schema.org';

/** Identificador del negocio: los productos lo citan como vendedor. */
export const STORE_ID = STORE_SITE_URL + '/#store';

export interface Breadcrumb {
  name: string;
  /** Ruta del sitio, p. ej. `/catalogo`. */
  path: string;
}

/**
 * Negocio local (Schema.org `Store`). Solo publica datos confirmados que viven en
 * las constantes del negocio: horario siempre; coordenadas solo cuando estén
 * cargadas (STORE_GEO); nunca código postal, calificaciones ni rango de precios.
 */
export function buildStoreJsonLd(): object {
  return {
    '@context': SCHEMA,
    '@type': 'Store',
    '@id': STORE_ID,
    name: STORE_CONTACT.businessName,
    description: SEO_DEFAULTS.description,
    url: STORE_SITE_URL + '/',
    image: absoluteUrl(SEO_DEFAULTS.image),
    logo: absoluteUrl('/images/logo-horizontal.png'),
    telephone: '+' + STORE_CONTACT.whatsappPhone,
    email: STORE_CONTACT.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: STORE_ADDRESS.streetAddress,
      addressLocality: STORE_ADDRESS.locality,
      addressRegion: STORE_ADDRESS.region,
      addressCountry: STORE_ADDRESS.countryCode
    },
    ...(STORE_GEO
      ? { geo: { '@type': 'GeoCoordinates', latitude: STORE_GEO.latitude, longitude: STORE_GEO.longitude } }
      : {}),
    openingHoursSpecification: STORE_OPENING_HOURS.map(hours => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.days.map(day => SCHEMA + '/' + day),
      opens: hours.opens,
      closes: hours.closes
    })),
    hasMap: STORE_CONTACT.mapsUrl,
    sameAs: STORE_SOCIAL_LINKS.map(link => link.url)
  };
}

/** Sitio web: le da a Google el nombre del sitio para los resultados. */
export function buildWebSiteJsonLd(): object {
  return {
    '@context': SCHEMA,
    '@type': 'WebSite',
    '@id': STORE_SITE_URL + '/#website',
    name: STORE_CONTACT.businessName,
    url: STORE_SITE_URL + '/',
    inLanguage: 'es-CO',
    publisher: { '@id': STORE_ID }
  };
}

export function buildBreadcrumbJsonLd(items: readonly Breadcrumb[]): object {
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}

/** Fotos generales del producto; si solo tiene fotos de tonos, esas. */
function productImageUrls(product: ProductDetail): string[] {
  const general = product.images.filter(image => image.productVariantId == null);

  return (general.length > 0 ? general : product.images).map(image => image.url);
}

function retailPrice(product: ProductDetail) {
  return product.prices.find(price => price.priceTypeCode === PRICE_TYPE_CODES.retail && price.amount > 0);
}

/**
 * Ficha completa: tiene foto y precio al detal. Solo esas se indexan y van al
 * sitemap (mismo criterio que `ProductRepository.GetActiveSitemapEntriesAsync`).
 */
export function isCompleteProduct(product: ProductDetail): boolean {
  return productImageUrls(product).length > 0 && retailPrice(product) !== undefined;
}

/**
 * Producto con los datos que entrega la API. La oferta solo se publica si la
 * respuesta trae precio detal: es el precio público, nunca uno mayorista de una
 * sesión. No declara disponibilidad porque el portal cotiza sin mostrar existencias.
 */
export function buildProductJsonLd(product: ProductDetail, path: string): object {
  const url = absoluteUrl(path);
  const images = productImageUrls(product);
  const retail = retailPrice(product);
  const category = product.categories[0]?.name;
  const brand = publicBrandName(product.brandName);

  return {
    '@context': SCHEMA,
    '@type': 'Product',
    '@id': url + '#product',
    name: product.name,
    sku: product.reference,
    url,
    ...(product.description ? { description: product.description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(category ? { category } : {}),
    ...(retail
      ? {
          offers: {
            '@type': 'Offer',
            url,
            price: retail.amount,
            priceCurrency: 'COP',
            itemCondition: SCHEMA + '/NewCondition',
            seller: { '@id': STORE_ID }
          }
        }
      : {})
  };
}

/**
 * Página de una marca: CollectionPage sobre la marca (Brand, con logo si lo tiene)
 * y la lista de sus fichas completas. Mismo contenido que entrega la función de
 * Static Web Apps en el HTML inicial.
 */
export function buildBrandPageJsonLd(
  brand: { name: string; slug: string; logoUrl?: string | null; description?: string | null },
  products: readonly { reference: string; name: string }[]
): object {
  const url = absoluteUrl('/marcas/' + encodeURIComponent(brand.slug));

  return {
    '@context': SCHEMA,
    '@type': 'CollectionPage',
    '@id': url + '#page',
    name: brand.name + ' en Cali al detal y por mayor',
    url,
    inLanguage: 'es-CO',
    ...(brand.description ? { description: brand.description } : {}),
    isPartOf: { '@id': STORE_SITE_URL + '/#website' },
    about: {
      '@type': 'Brand',
      name: brand.name,
      ...(brand.logoUrl ? { logo: brand.logoUrl } : {})
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.slice(0, 30).map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl('/catalogo/' + encodeURIComponent(product.reference)),
        name: product.name
      }))
    }
  };
}
