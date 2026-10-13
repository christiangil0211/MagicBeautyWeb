import {
  STORE_ADDRESS,
  STORE_CONTACT,
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
 * Negocio local (Schema.org `Store`). Solo publica datos confirmados que ya
 * viven en las constantes del negocio: sin horario, coordenadas ni código postal.
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

/**
 * Producto con los datos que entrega la API. La oferta solo se publica si la
 * respuesta trae precio detal: es el precio público, nunca uno mayorista de una
 * sesión. No declara disponibilidad porque el portal cotiza sin mostrar existencias.
 */
export function buildProductJsonLd(product: ProductDetail, path: string): object {
  const url = absoluteUrl(path);
  const images = product.images.filter(image => image.productVariantId == null).map(image => image.url);
  const retail = product.prices.find(price => price.priceTypeCode === PRICE_TYPE_CODES.retail);
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
