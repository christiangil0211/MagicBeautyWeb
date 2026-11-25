const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const { API_BASE_URL, API_TIMEOUT_MS, getSeoPageResponse, parsePath, resetSeoPageCache } = require('./seo-page');

const SITE = 'https://www.magicbeautycosmetics.com';

const SHELL = [
  '<!doctype html>',
  '<html lang="es">',
  '<head>',
  '  <title>Magic Beauty Cosmetics | Maquillaje y cosméticos en Cali</title>',
  '  <meta name="description" content="Descripción general.">',
  '  <meta property="og:title" content="General">',
  '  <meta property="og:description" content="Descripción general.">',
  '  <meta property="og:type" content="website">',
  '  <meta property="og:image" content="https://www.magicbeautycosmetics.com/images/og-magic-beauty.jpg">',
  '  <meta name="twitter:title" content="General">',
  '  <script src="main-ABC123.js" type="module"></script>',
  '</head>',
  '<body>',
  '  <app-root>',
  '    <div class="boot-loader"><p>Cargando…</p></div>',
  '  </app-root>',
  '</body>',
  '</html>'
].join('\n');

const PRODUCT = {
  id: 4,
  reference: 'ACE004',
  name: 'Aceite corporal <Dear Body>',
  description: 'Aceite hidratante con aroma a vainilla.',
  brandName: 'Dear Body',
  prices: [
    { priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 17000 },
    { priceTypeCode: 'WHOLESALE', priceTypeName: 'Por mayor', amount: 14000 }
  ],
  categories: [{ id: 3, name: 'Cuidado corporal', slug: 'cuidado-corporal' }],
  images: [{ id: 1, url: 'https://cdn/ace004.jpg', altText: null, productVariantId: null, displayOrder: 1, isMain: true }],
  variants: []
};

const TREE = [
  {
    id: 1,
    name: 'Maquillaje',
    slug: 'maquillaje',
    children: [{ id: 6, name: 'Labiales', slug: 'labiales', children: [] }]
  }
];

/**
 * Sitio y API simulados. `routes` asigna a cada final de URL una respuesta:
 * `{ status, json }`, `{ status, text }`, un Error o 'hang' (no responde).
 */
function server(routes = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find(suffix => url.endsWith(suffix));
    const reply = key ? routes[key] : url.endsWith('/index.csr.html') ? { text: SHELL, etag: '"v1"' } : { status: 500, text: 'sin ruta' };

    if (reply instanceof Error) {
      throw reply;
    }

    if (reply === 'hang') {
      // Como un API dormido: solo termina cuando vence el timeout de la función.
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason));
      });
    }

    return {
      status: reply.status ?? 200,
      headers: { get: name => (name.toLowerCase() === 'etag' ? (reply.etag ?? null) : null) },
      json: async () => {
        if (reply.json === undefined) throw new SyntaxError('no es JSON');
        return reply.json;
      },
      text: async () => reply.text ?? JSON.stringify(reply.json)
    };
  };

  return { fetchImpl, calls };
}

const open = (path, routes) => getSeoPageResponse({ originalUrl: SITE + path, ...server(routes) });

/** Lo que vería un buscador sin JavaScript. */
function read(html) {
  const meta = (attribute, key) => html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)">`))?.[1] ?? null;

  return {
    title: html.match(/<title>([^<]*)<\/title>/)?.[1],
    description: meta('name', 'description'),
    robots: meta('name', 'robots'),
    ogTitle: meta('property', 'og:title'),
    ogImage: meta('property', 'og:image'),
    canonical: html.match(/<link rel="canonical" href="([^"]*)">/)?.[1] ?? null,
    jsonLd: [...html.matchAll(/<script type="application\/ld\+json" data-seo-jsonld="[^"]*">([^<]*)<\/script>/g)].map(match =>
      JSON.parse(match[1])
    ),
    visible: html.match(/<main class="seo-fallback">([\s\S]*?)<\/main>/)?.[1] ?? null
  };
}

beforeEach(() => resetSeoPageCache());

test('recognizes product and category URLs, including encoded references and a trailing slash', () => {
  assert.deepEqual(parsePath('/catalogo/ACE004'), { kind: 'product', reference: 'ACE004' });
  assert.deepEqual(parsePath('/catalogo/ACE004/'), { kind: 'product', reference: 'ACE004' });
  assert.deepEqual(parsePath('/catalogo/ACE%20009'), { kind: 'product', reference: 'ACE 009' });
  assert.deepEqual(parsePath('/catalogo/categoria/labiales'), { kind: 'category', slug: 'labiales' });
  assert.deepEqual(parsePath('/catalogo/ACE004/extra'), { kind: 'unknown' });
  assert.deepEqual(parsePath('/catalogo/%E0%A4%A'), { kind: 'unknown' });
});

test('a product page brings its own title, description, canonical, JSON-LD and visible text in the HTML', async () => {
  const response = await open('/catalogo/ace004', { '/catalog/products/ace004': { json: PRODUCT } });
  const page = read(response.body);

  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.equal(page.title, 'Aceite corporal &lt;Dear Body&gt; · Dear Body en Cali · Magic Beauty Cosmetics');
  assert.equal(page.description, 'Aceite hidratante con aroma a vainilla.');
  assert.equal(page.robots, 'index, follow');
  // El canonical usa la referencia que devuelve el API, no la escrita en la URL.
  assert.equal(page.canonical, SITE + '/catalogo/ACE004');
  assert.equal(page.ogImage, 'https://cdn/ace004.jpg');

  const [product, breadcrumb] = page.jsonLd;
  assert.equal(product['@type'], 'Product');
  assert.equal(product.sku, 'ACE004');
  assert.deepEqual(product.offers.price, 17000);
  assert.equal(product.offers.priceCurrency, 'COP');
  assert.equal(product.offers.availability, undefined);
  assert.deepEqual(
    breadcrumb.itemListElement.map(item => item.item),
    [SITE + '/', SITE + '/catalogo', SITE + '/catalogo/categoria/cuidado-corporal', SITE + '/catalogo/ACE004']
  );

  assert.match(page.visible, /<h1>Aceite corporal &lt;Dear Body&gt;<\/h1>/);
  assert.match(page.visible, /Precio al detal: \$ 17\.000/);
  assert.doesNotMatch(page.visible, /14\.000/, 'nunca el precio mayorista');
});

test('keeps the app shell intact so Angular starts as usual', async () => {
  const response = await open('/catalogo/ACE004', { '/catalog/products/ACE004': { json: PRODUCT } });

  assert.match(response.body, /<script src="main-ABC123\.js" type="module"><\/script>/);
  assert.match(response.body, /<app-root>\s*<div class="boot-loader">/);
  assert.equal((response.body.match(/<title>/g) ?? []).length, 1);
  assert.equal((response.body.match(/name="description"/g) ?? []).length, 1);
  assert.equal((response.body.match(/property="og:title"/g) ?? []).length, 1);
});

test('a JSON-LD value can never close its <script> tag', async () => {
  const response = await open('/catalogo/ACE004', {
    '/catalog/products/ACE004': { json: { ...PRODUCT, description: '</script><script>alert(1)</script>' } }
  });

  assert.doesNotMatch(response.body, /<\/script><script>alert/);
});

test('caches a 200 for five minutes', async () => {
  const response = await open('/catalogo/ACE004', { '/catalog/products/ACE004': { json: PRODUCT } });

  assert.equal(response.headers['Cache-Control'], 'public, max-age=300');
  assert.equal(response.headers['Retry-After'], undefined);
});

for (const [label, product] of [
  ['without a photo', { ...PRODUCT, images: [] }],
  ['without a retail price', { ...PRODUCT, prices: [{ priceTypeCode: 'WHOLESALE', amount: 14000 }] }],
  ['with a zero retail price', { ...PRODUCT, prices: [{ priceTypeCode: 'RETAIL', amount: 0 }] }]
]) {
  test(`an incomplete product (${label}) answers 200 with noindex, like the sitemap`, async () => {
    const response = await open('/catalogo/ACE004', { '/catalog/products/ACE004': { json: product } });
    const page = read(response.body);

    assert.equal(response.status, 200);
    assert.equal(page.robots, 'noindex, follow');
    assert.equal(page.canonical, null);
    assert.deepEqual(page.jsonLd, []);
    assert.match(page.visible, /<h1>/);
  });
}

test('a product with only shade photos still counts as complete', async () => {
  const product = { ...PRODUCT, images: [{ id: 2, url: 'https://cdn/tono.jpg', productVariantId: 9 }] };
  const page = read((await open('/catalogo/ACE004', { '/catalog/products/ACE004': { json: product } })).body);

  assert.equal(page.robots, 'index, follow');
  assert.deepEqual(page.jsonLd[0].image, ['https://cdn/tono.jpg']);
});

test('answers 404 with the shell and no cache only when the API confirms the product does not exist', async () => {
  const response = await open('/catalogo/NOEXISTE', {
    '/catalog/products/NOEXISTE': { status: 404, json: { error: 'El producto no existe.' } }
  });
  const page = read(response.body);

  assert.equal(response.status, 404);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(page.robots, 'noindex, follow');
  assert.equal(page.title, 'Producto no encontrado · Magic Beauty Cosmetics');
  assert.equal(page.canonical, null);
  assert.match(response.body, /main-ABC123\.js/);
});

for (const [label, reply] of [
  ['a 500', { status: 500, text: 'Error' }],
  ['a 502', { status: 502, text: 'Bad gateway' }],
  ['a 503', { status: 503, text: 'Unavailable' }],
  ['a network error', new TypeError('fetch failed')],
  ['a non-JSON 200', { status: 200, text: '<html>Azure</html>' }]
]) {
  test(`answers 503 with the untouched shell and Retry-After: 300 on ${label}, never 404 or noindex`, async () => {
    const response = await open('/catalogo/ACE004', { '/catalog/products/ACE004': reply });

    assert.equal(response.status, 503);
    assert.equal(response.body, SHELL);
    assert.equal(response.headers['Retry-After'], '300');
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.doesNotMatch(response.body, /noindex/);
  });
}

test(`gives up on a sleeping API after ${API_TIMEOUT_MS} ms and answers 503 with the shell`, async () => {
  const started = Date.now();
  const response = await open('/catalogo/ACE004', { '/catalog/products/ACE004': 'hang' });
  const elapsed = Date.now() - started;

  assert.equal(response.status, 503);
  assert.equal(response.body, SHELL);
  assert.equal(response.headers['Retry-After'], '300');
  assert.ok(elapsed >= API_TIMEOUT_MS - 50 && elapsed < API_TIMEOUT_MS + 1500, `tardó ${elapsed} ms`);
});

test('asks the configured API for the product, with the reference encoded', async () => {
  const { fetchImpl, calls } = server({ '/catalog/products/ACE%20009': { json: { ...PRODUCT, reference: 'ACE 009' } } });

  await getSeoPageResponse({ originalUrl: SITE + '/catalogo/ACE%20009', fetchImpl });

  assert.ok(calls.some(call => call.url === API_BASE_URL + '/catalog/products/ACE%20009'));
  assert.ok(API_BASE_URL.startsWith('https://api-magic-beauty'));
});

test('a category page brings its heading, title, canonical, breadcrumb and subcategory links', async () => {
  const response = await open('/catalogo/categoria/maquillaje', { '/categories/catalog-tree': { json: TREE } });
  const page = read(response.body);

  assert.equal(response.status, 200);
  assert.equal(response.headers['Cache-Control'], 'public, max-age=300');
  assert.equal(page.title, 'Maquillaje en Cali al detal y por mayor · Magic Beauty Cosmetics');
  assert.equal(page.canonical, SITE + '/catalogo/categoria/maquillaje');
  assert.equal(page.robots, 'index, follow');
  assert.match(page.visible, /<h1>Catálogo de Maquillaje<\/h1>/);
  assert.match(page.visible, /<a href="\/catalogo\/categoria\/labiales">Labiales<\/a>/);
});

test('a subcategory keeps the full breadcrumb trail', async () => {
  const page = read((await open('/catalogo/categoria/labiales', { '/categories/catalog-tree': { json: TREE } })).body);

  assert.deepEqual(
    page.jsonLd[0].itemListElement.map(item => item.name),
    ['Inicio', 'Catálogo digital', 'Maquillaje', 'Labiales']
  );
});

test('an unknown category is a 404 only after the API answered with the tree', async () => {
  const response = await open('/catalogo/categoria/no-existe', { '/categories/catalog-tree': { json: TREE } });

  assert.equal(response.status, 404);
  assert.equal(read(response.body).title, 'Categoría no encontrada · Magic Beauty Cosmetics');
});

test('a category answers 503 (never 404) when the tree cannot be loaded', async () => {
  const response = await open('/catalogo/categoria/labiales', { '/categories/catalog-tree': { status: 500, text: 'Error' } });

  assert.equal(response.status, 503);
  assert.equal(response.headers['Retry-After'], '300');
});

test('reuses the last good category tree when the API fails afterwards', async () => {
  let now = 0;
  const first = server({ '/categories/catalog-tree': { json: TREE } });
  await getSeoPageResponse({ originalUrl: SITE + '/catalogo/categoria/labiales', fetchImpl: first.fetchImpl, now: () => now });

  now = 11 * 60 * 1000;
  const failing = server({ '/categories/catalog-tree': { status: 500, text: 'Error' } });
  const response = await getSeoPageResponse({ originalUrl: SITE + '/catalogo/categoria/labiales', fetchImpl: failing.fetchImpl, now: () => now });

  assert.equal(response.status, 200);
});

test('never answers 404 for the catalog page itself, even if it reaches the function', async () => {
  for (const path of ['/catalogo', '/catalogo/']) {
    const response = await open(path);

    assert.equal(response.status, 200, path);
    assert.equal(response.body, SHELL);
  }
});

test('a path the app does not have under /catalogo is a 404', async () => {
  const response = await open('/catalogo/ACE004/extra');

  assert.equal(response.status, 404);
  assert.equal(read(response.body).robots, 'noindex, follow');
});

test('revalidates the shell on every request so a new deploy never serves old bundle names', async () => {
  const { fetchImpl, calls } = server({
    '/catalog/products/ACE004': { json: PRODUCT },
    '/index.csr.html': { text: SHELL, etag: '"v1"' }
  });
  await getSeoPageResponse({ originalUrl: SITE + '/catalogo/ACE004', fetchImpl });
  await getSeoPageResponse({ originalUrl: SITE + '/catalogo/ACE004', fetchImpl });

  const shellCalls = calls.filter(call => call.url.endsWith('/index.csr.html'));
  assert.equal(shellCalls.length, 2);
  assert.equal(shellCalls[1].init.headers['If-None-Match'], '"v1"');
});

test('uses the cached shell on a 304', async () => {
  await open('/catalogo/ACE004', { '/catalog/products/ACE004': { json: PRODUCT } });
  const response = await open('/catalogo/ACE004', {
    '/catalog/products/ACE004': { json: PRODUCT },
    '/index.csr.html': { status: 304, text: '' }
  });

  assert.equal(response.status, 200);
  assert.match(response.body, /main-ABC123\.js/);
});

test('reads the shell from the preview environment, but never from a foreign host', async () => {
  const preview = 'https://mango-beach-053c1c010-18.centralus.6.azurestaticapps.net';
  const fromPreview = server({ '/catalog/products/ACE004': { json: PRODUCT } });
  await getSeoPageResponse({ originalUrl: preview + '/catalogo/ACE004', fetchImpl: fromPreview.fetchImpl });
  assert.ok(fromPreview.calls.some(call => call.url === preview + '/index.csr.html'));

  resetSeoPageCache();
  const foreign = server({ '/catalog/products/ACE004': { json: PRODUCT } });
  await getSeoPageResponse({ originalUrl: 'https://evil.example/catalogo/ACE004', fetchImpl: foreign.fetchImpl });
  assert.ok(foreign.calls.some(call => call.url === SITE + '/index.csr.html'));
  assert.ok(!foreign.calls.some(call => call.url.startsWith('https://evil.example')));
});

test('without the original URL it serves the untouched shell with 200, never a 404', async () => {
  const response = await getSeoPageResponse({ originalUrl: null, ...server() });

  assert.equal(response.status, 200);
  assert.equal(response.body, SHELL);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('answers a short 503 that reloads itself when not even the shell can be read', async () => {
  const response = await open('/catalogo/ACE004', { '/index.csr.html': new TypeError('fetch failed') });

  assert.equal(response.status, 503);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.match(response.body, /http-equiv="refresh"/);
});
