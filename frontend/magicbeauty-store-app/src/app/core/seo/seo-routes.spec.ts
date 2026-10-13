import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { SEO_DEFAULTS } from './seo.model';
import { SeoTitleStrategy } from './seo-title.strategy';

const SITE = 'https://www.magicbeautycosmetics.com';

const PRODUCT = {
  id: 7,
  reference: 'ACE009',
  name: 'Aceite capilar',
  description: 'Aceite reparador para puntas.',
  brandName: 'Milagros',
  prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 25000 }],
  hasVariants: false,
  availableQuantity: 4,
  categories: [{ id: 3, name: 'Cuidado capilar', slug: 'cuidado-capilar' }],
  images: [{ id: 1, url: 'https://cdn/ace009.jpg', altText: null, displayOrder: 1, isMain: true }],
  variants: []
};

const TREE = [
  { id: 1, name: 'Maquillaje', slug: 'maquillaje', children: [{ id: 6, name: 'Labiales', slug: 'labiales', children: [] }] }
];

/** Respuestas de la API por final de URL; lo que no figure aquí se responde vacío. */
type Api = Record<string, { body: object; status?: number }>;

async function open(url: string, api: Api = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      { provide: TitleStrategy, useExisting: SeoTitleStrategy },
      provideHttpClient(),
      provideHttpClientTesting()
    ]
  });

  const http = TestBed.inject(HttpTestingController);
  const answer = () =>
    http.match(() => true).forEach(request => {
      const path = request.request.url;
      const key = Object.keys(api).find(suffix => path.endsWith(suffix));

      if (path.endsWith('/auth/session')) {
        request.flush({ isAuthenticated: false, displayName: null, canManageStore: false });
      } else if (key && api[key].status) {
        request.flush(api[key].body, { status: api[key].status!, statusText: 'Error' });
      } else {
        request.flush(key ? api[key].body : []);
      }
    });

  const harness = await RouterTestingHarness.create();
  let settled = false;
  const navigation = harness.navigateByUrl(url);
  void navigation.then(() => (settled = true), () => (settled = true));

  while (!settled) {
    answer();
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Los datos de la página llegan después de la navegación.
  for (let round = 0; round < 5; round++) {
    answer();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  }

  const head = document.head;
  const meta = (selector: string) => head.querySelector(`meta[${selector}]`)?.getAttribute('content') ?? null;

  return {
    url: TestBed.inject(Router).url,
    element: harness.fixture.nativeElement as HTMLElement,
    title: document.title,
    description: meta('name="description"'),
    robots: meta('name="robots"'),
    ogTitle: meta('property="og:title"'),
    ogImage: meta('property="og:image"'),
    ogType: meta('property="og:type"'),
    canonical: head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    jsonLd: Array.from(head.querySelectorAll('script[type="application/ld+json"]')).map(
      script => JSON.parse(script.textContent ?? '') as Record<string, any>
    )
  };
}

afterEach(() => {
  document.head
    .querySelectorAll('meta[name], meta[property], link[rel="canonical"], script[type="application/ld+json"]')
    .forEach(element => element.remove());
});

describe('public pages', () => {
  it('gives the home page brand metadata, a canonical and the Store data', async () => {
    const page = await open('/');

    expect(page.title).toBe(SEO_DEFAULTS.title);
    expect(page.title).toContain('Magic Beauty Cosmetics');
    expect(page.title).toContain('Cali');
    expect(page.description).toBe(SEO_DEFAULTS.description);
    expect(page.robots).toBe('index, follow');
    expect(page.canonical).toBe(SITE + '/');
    expect(page.jsonLd.map(block => block['@type'])).toEqual(['Store', 'WebSite']);
    expect(page.element.querySelectorAll('h1').length).toBe(1);
  });

  it.each([
    ['/catalogo', 'Catálogo digital de maquillaje y cosméticos · Magic Beauty Cosmetics'],
    ['/catalogos', 'Catálogos en PDF · Magic Beauty Cosmetics']
  ])('gives %s its own title, description and canonical', async (url, title) => {
    const page = await open(url);

    expect(page.title).toBe(title);
    expect(page.ogTitle).toBe(title);
    expect(page.description).not.toBe(SEO_DEFAULTS.description);
    expect(page.description!.length).toBeGreaterThan(70);
    expect(page.description!.length).toBeLessThanOrEqual(170);
    expect(page.robots).toBe('index, follow');
    expect(page.canonical).toBe(SITE + url);
    expect(page.element.querySelectorAll('h1').length).toBe(1);
  });

  it('keeps tracking parameters out of the canonical', async () => {
    const page = await open('/catalogo?marca=Milagros&utm_source=instagram');

    expect(page.robots).toBe('index, follow');
    expect(page.canonical).toBe(SITE + '/catalogo');
  });
});

describe('pages kept out of search engines', () => {
  it.each(['/pedido', '/catalogo?q=labial', '/catalogo/categoria/labiales?q=rojo'])('marks %s noindex without a canonical', async url => {
    const page = await open(url, { '/categories/catalog-tree': { body: TREE } });

    expect(page.url).toBe(url);
    expect(page.robots).toBe('noindex, follow');
    expect(page.canonical).toBeNull();
    expect(page.jsonLd).toEqual([]);
  });

  it('shows a noindex page for an unknown address instead of the home page', async () => {
    const page = await open('/esta-pagina-no-existe');

    expect(page.url).toBe('/esta-pagina-no-existe');
    expect(page.title).toBe('Página no encontrada · Magic Beauty Cosmetics');
    expect(page.robots).toBe('noindex, follow');
    expect(page.canonical).toBeNull();
    expect(page.element.querySelector('h1')?.textContent).toContain('No encontramos esta página');
    expect(page.element.querySelector('app-not-found a[href="/catalogo"]')).not.toBeNull();
  });

  it('marks an unknown product noindex', async () => {
    const page = await open('/catalogo/NOEXISTE', {
      '/catalog/products/NOEXISTE': { body: { error: 'El producto no existe.' }, status: 404 }
    });

    expect(page.title).toBe('Producto no encontrado · Magic Beauty Cosmetics');
    expect(page.robots).toBe('noindex, follow');
    expect(page.canonical).toBeNull();
    expect(page.jsonLd).toEqual([]);
  });

  it('marks an unknown category noindex', async () => {
    const page = await open('/catalogo/categoria/no-existe', { '/categories/catalog-tree': { body: TREE } });

    expect(page.title).toBe('Categoría no encontrada · Magic Beauty Cosmetics');
    expect(page.robots).toBe('noindex, follow');
    expect(page.canonical).toBeNull();
  });
});

describe('product page', () => {
  const api: Api = {
    '/catalog/products/ACE009': { body: PRODUCT },
    '/catalog/products/ACE009/related': { body: [] }
  };

  it('uses the product data for title, description, canonical and preview image', async () => {
    const page = await open('/catalogo/ACE009', api);

    expect(page.title).toBe('Aceite capilar · Milagros · Magic Beauty Cosmetics');
    expect(page.description).toBe('Aceite reparador para puntas.');
    expect(page.robots).toBe('index, follow');
    expect(page.canonical).toBe(SITE + '/catalogo/ACE009');
    expect(page.ogType).toBe('product');
    expect(page.ogImage).toBe('https://cdn/ace009.jpg');
    expect(page.element.querySelectorAll('h1').length).toBe(1);
    expect(page.element.querySelector('h1')?.textContent).toContain('Aceite capilar');
  });

  it('publishes Product and BreadcrumbList structured data from the API response', async () => {
    const page = await open('/catalogo/ACE009', api);
    const product = page.jsonLd.find(block => block['@type'] === 'Product')!;
    const breadcrumb = page.jsonLd.find(block => block['@type'] === 'BreadcrumbList')!;

    expect(product['sku']).toBe('ACE009');
    expect(product['brand']['name']).toBe('Milagros');
    expect(product['offers']['price']).toBe(25000);
    expect(product['offers']['priceCurrency']).toBe('COP');
    expect(breadcrumb['itemListElement'].map((item: Record<string, string>) => item['item'])).toEqual([
      SITE + '/',
      SITE + '/catalogo',
      SITE + '/catalogo/categoria/cuidado-capilar',
      SITE + '/catalogo/ACE009'
    ]);
  });

  it('asks only for related products, never for the whole catalog', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting()]
    });

    const http = TestBed.inject(HttpTestingController);
    const requested: string[] = [];
    const harness = await RouterTestingHarness.create();
    let settled = false;
    const navigation = harness.navigateByUrl('/catalogo/ACE009');
    void navigation.then(() => (settled = true), () => (settled = true));

    for (let round = 0; round < 40 && (!settled || round < 8); round++) {
      http.match(() => true).forEach(request => {
        const path = request.request.urlWithParams;
        requested.push(path);

        if (path.endsWith('/auth/session')) {
          request.flush({ isAuthenticated: false, displayName: null, canManageStore: false });
        } else {
          request.flush(path.endsWith('/catalog/products/ACE009') ? PRODUCT : []);
        }
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    expect(requested.some(path => path.endsWith('/catalog/products/ACE009/related?limit=5'))).toBe(true);
    expect(requested.some(path => /\/catalog\/products(\?|$)/.test(path))).toBe(false);
  });
});

describe('category pages', () => {
  const labial = {
    id: 1, reference: 'LAB001', name: 'Labial mate', brandName: 'Milagros', hasVariants: false,
    availableQuantity: 3, categoryIds: [6], prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 12000 }]
  };
  const api: Api = { '/categories/catalog-tree': { body: TREE }, '/catalog/products': { body: [labial] } };

  it('keeps a category without products out of search engines until it has some', async () => {
    const page = await open('/catalogo/categoria/labiales', { '/categories/catalog-tree': { body: TREE } });

    expect(page.title).toBe('Labiales al detal y al por mayor · Magic Beauty Cosmetics');
    expect(page.robots).toBe('noindex, follow');
    expect(page.canonical).toBeNull();
  });

  it('indexes a parent category whose products live in a subcategory', async () => {
    const page = await open('/catalogo/categoria/maquillaje', api);

    expect(page.robots).toBe('index, follow');
    expect(page.canonical).toBe(SITE + '/catalogo/categoria/maquillaje');
  });

  it('gives each category its own heading, title, canonical and breadcrumbs', async () => {
    const page = await open('/catalogo/categoria/labiales', api);

    expect(page.title).toBe('Labiales al detal y al por mayor · Magic Beauty Cosmetics');
    expect(page.description).toContain('Labiales en Magic Beauty Cosmetics, Cali');
    expect(page.robots).toBe('index, follow');
    expect(page.canonical).toBe(SITE + '/catalogo/categoria/labiales');
    expect(page.element.querySelectorAll('h1').length).toBe(1);
    expect(page.element.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Catálogo de Labiales');
    expect(page.jsonLd[0]['itemListElement'].map((item: Record<string, string>) => item['name'])).toEqual([
      'Inicio',
      'Catálogo digital',
      'Maquillaje',
      'Labiales'
    ]);
  });

  it('keeps the category selected as a filter of the digital catalog', async () => {
    const page = await open('/catalogo/categoria/labiales', api);
    const checked = Array.from(page.element.querySelectorAll<HTMLInputElement>('.filters input[type="checkbox"]:checked'));

    expect(checked.length).toBe(1);
    expect(checked[0].closest('label')?.textContent).toContain('Labiales');
  });

  it.each([
    ['/catalogo?categoria=labiales', '/catalogo/categoria/labiales'],
    ['/catalogo?categoria=labiales&marca=Milagros', '/catalogo/categoria/labiales?marca=Milagros'],
    ['/categoria/labiales', '/catalogo/categoria/labiales']
  ])('sends the old link %s to the category page %s', async (from, to) => {
    expect((await open(from, api)).url).toBe(to);
  });

  it('restores the catalog heading after leaving a category', async () => {
    const page = await open('/catalogo/categoria/labiales', api);

    await TestBed.inject(Router).navigateByUrl('/catalogo');
    await new Promise(resolve => setTimeout(resolve, 20));
    TestBed.inject(HttpTestingController).match(() => true).forEach(request => request.flush([]));

    const heading = () => page.element.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();

    await vi.waitFor(() => expect(heading()).toBe('Catálogo mayorista'));
    expect(document.title).toBe('Catálogo digital de maquillaje y cosméticos · Magic Beauty Cosmetics');
  });
});
