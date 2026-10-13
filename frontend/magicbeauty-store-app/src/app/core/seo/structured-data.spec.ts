import { STORE_ADDRESS, STORE_CONTACT, STORE_SOCIAL_LINKS } from '../constants/store-contact';
import { ProductDetail } from '../../shared/models/product.model';
import {
  STORE_ID,
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  buildStoreJsonLd,
  buildWebSiteJsonLd
} from './structured-data';

const SITE = 'https://www.magicbeautycosmetics.com';

type Json = Record<string, any>;

const product = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
  id: 7,
  reference: 'ACE009',
  name: 'Aceite capilar',
  description: 'Aceite reparador para puntas.',
  brandName: 'Milagros',
  prices: [
    { priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 25000 },
    { priceTypeCode: 'WHOLESALE', priceTypeName: 'Por mayor', amount: 18000 }
  ],
  hasVariants: false,
  availableQuantity: 4,
  categories: [{ id: 3, name: 'Cuidado capilar', slug: 'cuidado-capilar' }],
  images: [
    { id: 1, url: 'https://cdn/ace009.jpg', displayOrder: 1, isMain: true },
    { id: 2, productVariantId: 9, url: 'https://cdn/ace009-tono.jpg', displayOrder: 2, isMain: false }
  ],
  variants: [],
  ...overrides
});

describe('Store', () => {
  const store = buildStoreJsonLd() as Json;

  it('is a Schema.org Store with the required name, address and url', () => {
    expect(store['@context']).toBe('https://schema.org');
    expect(store['@type']).toBe('Store');
    expect(store['@id']).toBe(STORE_ID);
    expect(store['name']).toBe('Magic Beauty Cosmetics');
    expect(store['url']).toBe(SITE + '/');
    expect(store['image']).toMatch(/^https:\/\/www\.magicbeautycosmetics\.com\/images\//);
  });

  it('publishes the confirmed business data from the shared constants', () => {
    expect(store['telephone']).toBe('+573127381185');
    expect(store['telephone']).toBe('+' + STORE_CONTACT.whatsappPhone);
    expect(store['email']).toBe(STORE_CONTACT.email);
    expect(store['hasMap']).toBe(STORE_CONTACT.mapsUrl);
    expect(store['sameAs']).toEqual(STORE_SOCIAL_LINKS.map(link => link.url));
    expect(store['address']).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Calle 13 # 44A - 26',
      addressLocality: 'Cali',
      addressRegion: 'Valle del Cauca',
      addressCountry: 'CO'
    });
    // La dirección visible del pie es la misma que la estructurada.
    expect(STORE_CONTACT.address).toBe(`${STORE_ADDRESS.streetAddress}, ${STORE_ADDRESS.locality}`);
  });

  it('does not invent hours, coordinates, postal code or ratings', () => {
    for (const field of ['openingHours', 'openingHoursSpecification', 'geo', 'priceRange', 'aggregateRating', 'review']) {
      expect(store).not.toHaveProperty(field);
    }

    expect(store['address']).not.toHaveProperty('postalCode');
  });

  it('survives JSON serialization', () => {
    expect(JSON.parse(JSON.stringify(store))).toEqual(store);
  });
});

it('describes the website and links it to the store', () => {
  const site = buildWebSiteJsonLd() as Json;

  expect(site['@type']).toBe('WebSite');
  expect(site['name']).toBe('Magic Beauty Cosmetics');
  expect(site['url']).toBe(SITE + '/');
  expect(site['publisher']).toEqual({ '@id': STORE_ID });
});

it('numbers breadcrumbs from 1 with absolute URLs', () => {
  const list = buildBreadcrumbJsonLd([
    { name: 'Inicio', path: '/' },
    { name: 'Catálogo digital', path: '/catalogo' },
    { name: 'Aceite capilar', path: '/catalogo/ACE009' }
  ]) as Json;

  expect(list['@type']).toBe('BreadcrumbList');
  expect(list['itemListElement']).toEqual([
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Catálogo digital', item: SITE + '/catalogo' },
    { '@type': 'ListItem', position: 3, name: 'Aceite capilar', item: SITE + '/catalogo/ACE009' }
  ]);
});

describe('Product', () => {
  it('uses the data the API returned for the product', () => {
    const data = buildProductJsonLd(product(), '/catalogo/ACE009') as Json;

    expect(data['@type']).toBe('Product');
    expect(data['name']).toBe('Aceite capilar');
    expect(data['sku']).toBe('ACE009');
    expect(data['url']).toBe(SITE + '/catalogo/ACE009');
    expect(data['description']).toBe('Aceite reparador para puntas.');
    expect(data['brand']).toEqual({ '@type': 'Brand', name: 'Milagros' });
    expect(data['category']).toBe('Cuidado capilar');
    // Solo las imágenes generales: las de un tono no representan al producto.
    expect(data['image']).toEqual(['https://cdn/ace009.jpg']);
  });

  it('offers only the public retail price, in Colombian pesos', () => {
    const offer = (buildProductJsonLd(product(), '/catalogo/ACE009') as Json)['offers'];

    expect(offer).toEqual({
      '@type': 'Offer',
      url: SITE + '/catalogo/ACE009',
      price: 25000,
      priceCurrency: 'COP',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': STORE_ID }
    });
    expect(JSON.stringify(offer)).not.toContain('18000');
    // El portal cotiza sin mostrar existencias: tampoco se declaran aquí.
    expect(offer).not.toHaveProperty('availability');
  });

  it('omits the offer when the response has no retail price', () => {
    const data = buildProductJsonLd(
      product({ prices: [{ priceTypeCode: 'WHOLESALE', priceTypeName: 'Por mayor', amount: 18000 }] }),
      '/catalogo/ACE009'
    ) as Json;

    expect(data).not.toHaveProperty('offers');
  });

  it('does not announce the "Sin marca" placeholder as a brand', () => {
    expect(buildProductJsonLd(product({ brandName: 'Sin marca' }), '/catalogo/ACE009')).not.toHaveProperty('brand');
  });

  it('omits optional fields the product does not have', () => {
    const data = buildProductJsonLd(
      product({ description: null, brandName: '', images: [], categories: [] }),
      '/catalogo/ACE009'
    ) as Json;

    for (const field of ['description', 'brand', 'image', 'category']) {
      expect(data).not.toHaveProperty(field);
    }
  });
});
