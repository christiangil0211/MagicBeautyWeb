import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { SEO_DEFAULTS, absoluteUrl, toMetaDescription } from './seo.model';
import { SeoService } from './seo.service';

const SITE = 'https://www.magicbeautycosmetics.com';

function setup() {
  const seo = TestBed.inject(SeoService);
  const head = TestBed.inject(DOCUMENT).head;
  const meta = (selector: string) => head.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null;
  const canonical = () => head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
  const jsonLd = () =>
    Array.from(head.querySelectorAll('script[type="application/ld+json"]')).map(script => JSON.parse(script.textContent ?? ''));

  return { seo, head, meta, canonical, jsonLd };
}

afterEach(() => {
  // El <head> es compartido entre pruebas: se deja como lo encontraría una página nueva.
  const head = document.head;
  head.querySelectorAll('meta[name], meta[property], link[rel="canonical"], script[type="application/ld+json"]')
    .forEach(element => element.remove());
});

it('writes title, description, robots and an absolute canonical', () => {
  const { seo, meta, canonical } = setup();

  seo.apply({ title: 'Catálogo · Magic Beauty Cosmetics', description: 'Maquillaje en Cali.', path: '/catalogo' });

  expect(document.title).toBe('Catálogo · Magic Beauty Cosmetics');
  expect(meta('name="description"')).toBe('Maquillaje en Cali.');
  expect(meta('name="robots"')).toBe('index, follow');
  expect(canonical()).toBe(SITE + '/catalogo');
});

it('writes Open Graph and Twitter Card tags with absolute URLs', () => {
  const { seo, meta } = setup();

  seo.apply({ title: 'Labial', description: 'Labial mate.', path: '/catalogo/ACE009', type: 'product', image: 'https://cdn/labial.jpg' });

  expect(meta('property="og:title"')).toBe('Labial');
  expect(meta('property="og:description"')).toBe('Labial mate.');
  expect(meta('property="og:type"')).toBe('product');
  expect(meta('property="og:url"')).toBe(SITE + '/catalogo/ACE009');
  expect(meta('property="og:image"')).toBe('https://cdn/labial.jpg');
  expect(meta('property="og:site_name"')).toBe('Magic Beauty Cosmetics');
  expect(meta('property="og:locale"')).toBe('es_CO');
  expect(meta('name="twitter:card"')).toBe('summary_large_image');
  expect(meta('name="twitter:title"')).toBe('Labial');
  expect(meta('name="twitter:image"')).toBe('https://cdn/labial.jpg');
});

it('falls back to the brand description and image', () => {
  const { seo, meta } = setup();

  seo.apply({ title: 'Inicio', path: '/' });

  expect(meta('name="description"')).toBe(SEO_DEFAULTS.description);
  expect(meta('property="og:image"')).toBe(SITE + SEO_DEFAULTS.image);
});

it('marks a page noindex and drops its canonical and structured data', () => {
  const { seo, meta, canonical, jsonLd } = setup();

  seo.apply({ title: 'Mi pedido', path: '/pedido', noindex: true, jsonLd: { store: { '@type': 'Store' } } });

  expect(meta('name="robots"')).toBe('noindex, follow');
  expect(canonical()).toBeNull();
  expect(meta('property="og:url"')).toBeNull();
  expect(jsonLd()).toEqual([]);
});

it('replaces the previous page completely instead of accumulating tags', () => {
  const { seo, head, canonical, jsonLd } = setup();

  seo.apply({ title: 'Producto A', path: '/catalogo/A', jsonLd: { product: { name: 'A' }, breadcrumb: { name: 'ruta' } } });
  seo.apply({ title: 'Producto B', path: '/catalogo/B', jsonLd: { product: { name: 'B' } } });

  expect(canonical()).toBe(SITE + '/catalogo/B');
  expect(head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
  expect(head.querySelectorAll('meta[name="description"]').length).toBe(1);
  expect(head.querySelectorAll('meta[property="og:title"]').length).toBe(1);
  expect(jsonLd()).toEqual([{ name: 'B' }]);
});

it('keeps structured data valid when a text tries to close the script tag', () => {
  const { seo, head, jsonLd } = setup();
  const name = 'Labial </script><script>alert(1)</script>';

  seo.apply({ title: 'Producto', path: '/catalogo/X', jsonLd: { product: { name } } });

  expect(head.querySelectorAll('script[type="application/ld+json"]').length).toBe(1);
  expect(head.querySelector('script[type="application/ld+json"]')?.textContent).not.toContain('</script>');
  expect(jsonLd()).toEqual([{ name }]);
});

it('notifies pages with their own metadata after each navigation', () => {
  const { seo } = setup();
  const before = seo.navigation();

  seo.notifyNavigation();

  expect(seo.navigation()).toBe(before + 1);
});

it('builds absolute URLs on the canonical domain', () => {
  expect(absoluteUrl('/catalogo')).toBe(SITE + '/catalogo');
  expect(absoluteUrl('catalogo')).toBe(SITE + '/catalogo');
  expect(absoluteUrl('https://cdn/imagen.jpg')).toBe('https://cdn/imagen.jpg');
});

it('trims long descriptions at a word boundary', () => {
  const long = 'Labial de larga duración con acabado mate. '.repeat(10);
  const result = toMetaDescription(long);

  expect(result.length).toBeLessThanOrEqual(160);
  expect(result.endsWith('…')).toBe(true);
  expect(toMetaDescription('  Texto   corto.  ')).toBe('Texto corto.');
});
