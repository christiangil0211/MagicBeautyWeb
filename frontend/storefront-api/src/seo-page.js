/**
 * HTML inicial de las fichas (/catalogo/{ref}) y de las categorías
 * (/catalogo/categoria/{slug}) para buscadores.
 *
 * El sitio es estático: sin esto, toda URL recibe el mismo index.csr.html con
 * estado 200 y Google tiene que ejecutar JavaScript para saber de qué trata la
 * página. staticwebapp.config.json reescribe esas rutas hacia esta función, que
 * devuelve el mismo index.csr.html (la app arranca igual) con el título, la
 * descripción, el canonical, el JSON-LD y un texto visible ya puestos.
 *
 *   200  producto o categoría existente (noindex si la ficha está incompleta)
 *   404  el API confirma que no existe (o la ruta no existe en la app)
 *   503  el API falló o no respondió a tiempo: Google vuelve a intentar
 *
 * Los 404 y 503 llevan el shell completo en el cuerpo: la clienta ve la página
 * normal porque Angular arranca igual. Un error del API nunca se vuelve 404.
 *
 * Los textos y el JSON-LD replican lo que hace Angular (product-detail,
 * digital-catalog y core/seo/structured-data.ts): al arrancar, la app los
 * reemplaza por los suyos sin duplicarlos.
 *
 * Este archivo no depende del SDK de Azure Functions para poder probarlo solo.
 */

const { SITEMAP_SOURCE_URL } = require('./sitemap-proxy');

const SITE_URL = 'https://www.magicbeautycosmetics.com';
const STORE_ID = SITE_URL + '/#store';
const SCHEMA = 'https://schema.org';
const BUSINESS_NAME = 'Magic Beauty Cosmetics';
const DEFAULT_IMAGE = SITE_URL + '/images/og-magic-beauty.jpg';

/** Mismo host que el sitemap (el de apiBaseUrl en environment.production.ts). */
const API_BASE_URL = new URL(SITEMAP_SOURCE_URL).origin + '/api';

/** Corto a propósito: si el API no responde en este tiempo, 503 y Google reintenta. */
const API_TIMEOUT_MS = 4_000;
const SHELL_TIMEOUT_MS = 4_000;
const SHELL_PATH = '/index.csr.html';

/** El árbol de categorías cambia poco: se reutiliza unos minutos. */
const TREE_FRESH_FOR_MS = 10 * 60 * 1000;

const PAGE_CACHE = 'public, max-age=300';
const NO_CACHE = 'no-store';
const RETRY_AFTER_SECONDS = '300';

/**
 * Hosts desde los que se acepta leer el shell. La URL original la pone Static
 * Web Apps, pero nunca se descarga HTML de un host que no sea el del sitio.
 */
const ALLOWED_HOSTS = [/^(www\.)?magicbeautycosmetics\.com$/i, /^mango-beach-053c1c010(-[\w-]+)?\.([\w-]+\.)*azurestaticapps\.net$/i];

let shellCache = null;
let treeCache = null;

class ApiUnavailableError extends Error {}

// ---------------------------------------------------------------- rutas

/**
 * Qué pide la URL: una ficha, una categoría o algo que la app no tiene.
 * Se toleran la barra final y la codificación de la referencia.
 */
function parsePath(pathname) {
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean).map(safeDecode);

  if (segments[0] !== 'catalogo' || segments.some(segment => segment === null)) {
    return { kind: 'unknown' };
  }

  // El catálogo en sí (/catalogo) es una página prerenderizada que el hosting
  // sirve antes de llegar aquí; si aun así llega, nunca debe ser un 404.
  if (segments.length === 1) {
    return { kind: 'catalog' };
  }

  if (segments.length === 3 && segments[1] === 'categoria') {
    return { kind: 'category', slug: segments[2] };
  }

  if (segments.length === 2) {
    return { kind: 'product', reference: segments[1] };
  }

  return { kind: 'unknown' };
}

function safeDecode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Origen desde el que leer el shell: el del propio sitio (producción o vista previa). */
function shellOrigin(originalUrl) {
  try {
    const url = new URL(originalUrl);

    return ALLOWED_HOSTS.some(pattern => pattern.test(url.hostname)) ? url.origin : SITE_URL;
  } catch {
    return SITE_URL;
  }
}

// ---------------------------------------------------------------- datos

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new ApiUnavailableError(`${url}: ${error instanceof Error ? error.message : error}`);
  }
}

/** JSON del API. `null` solo si el API respondió 404; cualquier otra falla lanza. */
async function fetchApiJson(fetchImpl, path) {
  const response = await fetchWithTimeout(fetchImpl, API_BASE_URL + path, { headers: { Accept: 'application/json' } }, API_TIMEOUT_MS);

  if (response.status === 404) {
    return null;
  }

  if (response.status !== 200) {
    throw new ApiUnavailableError(`${path}: el API respondió ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new ApiUnavailableError(`${path}: respuesta que no es JSON`);
  }
}

/**
 * index.csr.html del sitio. Se revalida en cada petición con ETag: tras un
 * despliegue cambia (los nombres de los bundles también) y una copia vieja
 * dejaría la app en blanco.
 */
async function getShell(fetchImpl, origin) {
  const cached = shellCache && shellCache.origin === origin ? shellCache : null;

  try {
    const response = await fetchWithTimeout(
      fetchImpl,
      origin + SHELL_PATH,
      { headers: cached?.etag ? { 'If-None-Match': cached.etag } : {} },
      SHELL_TIMEOUT_MS
    );

    if (response.status === 304 && cached) {
      return cached.body;
    }

    const body = response.status === 200 ? await response.text() : '';

    if (!body.includes('<app-root')) {
      throw new Error(`el shell respondió ${response.status} sin <app-root>`);
    }

    shellCache = { origin, body, etag: response.headers?.get?.('etag') ?? null };
    return body;
  } catch (error) {
    if (cached) {
      return cached.body;
    }

    throw error;
  }
}

/** Árbol público de categorías; ante una falla se usa la última copia buena. */
async function getCategoryTree(fetchImpl, now) {
  if (treeCache && now() - treeCache.at < TREE_FRESH_FOR_MS) {
    return treeCache.tree;
  }

  try {
    const tree = await fetchApiJson(fetchImpl, '/categories/catalog-tree');

    if (!Array.isArray(tree)) {
      throw new ApiUnavailableError('el árbol de categorías no es una lista');
    }

    treeCache = { tree, at: now() };
    return tree;
  } catch (error) {
    if (treeCache) {
      return treeCache.tree;
    }

    throw error;
  }
}

/** Camino desde la raíz hasta la categoría del slug, o null si no existe. */
function findTrail(tree, slug, trail = []) {
  for (const category of tree) {
    const path = [...trail, category];

    if (category.slug === slug) {
      return path;
    }

    const found = findTrail(category.children ?? [], slug, path);

    if (found) {
      return found;
    }
  }

  return null;
}

// ---------------------------------------------------------------- páginas

function publicBrandName(brandName) {
  const name = (brandName ?? '').trim();

  return name && name.toLowerCase() !== 'sin marca' ? name : null;
}

/** Igual que toMetaDescription (core/seo/seo.model.ts). */
function toMetaDescription(text, max = 160) {
  const clean = text.replace(/\s+/g, ' ').trim();

  if (clean.length <= max) {
    return clean;
  }

  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');

  return (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:]+$/, '') + '…';
}

function productImages(product) {
  const images = product.images ?? [];
  const general = images.filter(image => image.productVariantId == null);

  return general.length > 0 ? general : images;
}

function retailPrice(product) {
  return (product.prices ?? []).find(price => price.priceTypeCode === 'RETAIL' && price.amount > 0);
}

/** Misma regla que isCompleteProduct (frontend) y el sitemap (API). */
function isCompleteProduct(product) {
  return productImages(product).length > 0 && retailPrice(product) !== undefined;
}

function formatCop(amount) {
  return '$ ' + String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function breadcrumbJsonLd(items) {
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: SITE_URL + item.path
    }))
  };
}

function productPage(product) {
  const path = '/catalogo/' + encodeURIComponent(product.reference);
  const url = SITE_URL + path;
  const brand = publicBrandName(product.brandName);
  const category = (product.categories ?? [])[0];
  const images = productImages(product);
  const retail = retailPrice(product);
  const complete = isCompleteProduct(product);
  const description = toMetaDescription(
    product.description?.trim() ||
      `${product.name}${brand ? ' de ' + brand : ''} (ref. ${product.reference}) en Magic Beauty Cosmetics, Cali. Consulta precios al detal y al por mayor y pide por WhatsApp.`
  );
  const crumbs = [
    { name: 'Inicio', path: '/' },
    { name: 'Catálogo digital', path: '/catalogo' },
    ...(category ? [{ name: category.name, path: '/catalogo/categoria/' + category.slug }] : []),
    { name: product.name, path }
  ];

  return {
    title: [product.name, brand].filter(Boolean).join(' · ') + ' en Cali · Magic Beauty Cosmetics',
    description,
    // Ficha incompleta: noindex, sin canonical ni JSON-LD (igual que SeoService).
    noindex: !complete,
    path,
    type: 'product',
    image: images[0]?.url,
    imageAlt: images[0]?.altText || product.name,
    jsonLd: complete
      ? {
          product: {
            '@context': SCHEMA,
            '@type': 'Product',
            '@id': url + '#product',
            name: product.name,
            sku: product.reference,
            url,
            ...(product.description ? { description: product.description } : {}),
            ...(images.length > 0 ? { image: images.map(image => image.url) } : {}),
            ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
            ...(category ? { category: category.name } : {}),
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
          },
          breadcrumb: breadcrumbJsonLd(crumbs)
        }
      : {},
    body: [
      breadcrumbHtml(crumbs),
      `<h1>${escapeHtml(product.name)}</h1>`,
      images[0] ? `<img src="${escapeHtml(images[0].url)}" alt="${escapeHtml(images[0].altText || product.name)}" width="480" height="480">` : '',
      `<p>${brand ? 'Marca: ' + escapeHtml(brand) + ' · ' : ''}Ref. ${escapeHtml(product.reference)}</p>`,
      retail ? `<p>Precio al detal: ${formatCop(retail.amount)}</p>` : '',
      product.description ? `<p>${escapeHtml(product.description)}</p>` : '',
      '<p>Pide al detal o al por mayor por WhatsApp. Tienda en Cali, envíos a toda Colombia.</p>',
      '<p><a href="/catalogo">Ver el catálogo digital</a></p>'
    ].join('')
  };
}

function categoryPage(trail) {
  const category = trail[trail.length - 1];
  const path = '/catalogo/categoria/' + category.slug;
  const crumbs = [
    { name: 'Inicio', path: '/' },
    { name: 'Catálogo digital', path: '/catalogo' },
    ...trail.map(item => ({ name: item.name, path: '/catalogo/categoria/' + item.slug }))
  ];
  const children = category.children ?? [];

  return {
    title: `${category.name} en Cali al detal y por mayor · Magic Beauty Cosmetics`,
    description: toMetaDescription(
      `${category.name} en Magic Beauty Cosmetics, Cali: consulta precios al detal y al por mayor, arma tu pedido y envíalo por WhatsApp. Envíos a toda Colombia.`
    ),
    // Si resulta vacía, la app la marca noindex al cargar la lista (como hoy).
    noindex: false,
    path,
    type: 'website',
    jsonLd: { breadcrumb: breadcrumbJsonLd(crumbs) },
    body: [
      breadcrumbHtml(crumbs),
      `<h1>Catálogo de ${escapeHtml(category.name)}</h1>`,
      `<p>${escapeHtml(category.name)} en Magic Beauty Cosmetics, Cali: precios al detal y al por mayor. Arma tu pedido y envíalo por WhatsApp.</p>`,
      children.length > 0
        ? '<ul>' +
          children
            .map(child => `<li><a href="/catalogo/categoria/${escapeHtml(child.slug)}">${escapeHtml(child.name)}</a></li>`)
            .join('') +
          '</ul>'
        : '',
      '<p><a href="/catalogo">Ver el catálogo digital</a></p>'
    ].join('')
  };
}

function notFoundPage(kind) {
  return {
    title: kind === 'category' ? 'Categoría no encontrada · Magic Beauty Cosmetics' : kind === 'product' ? 'Producto no encontrado · Magic Beauty Cosmetics' : 'Página no encontrada · Magic Beauty Cosmetics',
    noindex: true,
    jsonLd: {},
    body: ''
  };
}

function breadcrumbHtml(crumbs) {
  return (
    '<nav aria-label="Ruta de navegación">' +
    crumbs.map(crumb => `<a href="${escapeHtml(crumb.path)}">${escapeHtml(crumb.name)}</a>`).join(' › ') +
    '</nav>'
  );
}

// ---------------------------------------------------------------- HTML

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Reemplaza el <meta> existente o lo agrega antes de </head>. */
function setMeta(html, attribute, key, content) {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`;
  const pattern = new RegExp(`<meta ${attribute}="${escapeRegExp(key)}" content="[^"]*"\\s*/?>`);

  return pattern.test(html) ? html.replace(pattern, () => tag) : html.replace('</head>', () => `  ${tag}\n</head>`);
}

/**
 * Pone los metadatos de la página en el shell. Los nombres y atributos son los
 * que usa SeoService: al arrancar, Angular actualiza estas mismas etiquetas.
 */
function renderPage(shell, page) {
  const canonical = page.noindex || !page.path ? null : SITE_URL + page.path;
  const description = page.description ?? null;
  const image = page.image ?? DEFAULT_IMAGE;
  let html = shell.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(page.title)}</title>`);

  html = setMeta(html, 'name', 'robots', page.noindex ? 'noindex, follow' : 'index, follow');

  if (description) {
    html = setMeta(html, 'name', 'description', description);
    html = setMeta(html, 'property', 'og:description', description);
    html = setMeta(html, 'name', 'twitter:description', description);
  }

  html = setMeta(html, 'property', 'og:title', page.title);
  html = setMeta(html, 'name', 'twitter:title', page.title);

  if (!page.noindex) {
    html = setMeta(html, 'property', 'og:type', page.type ?? 'website');
    html = setMeta(html, 'property', 'og:image', image);
    html = setMeta(html, 'property', 'og:image:alt', page.imageAlt ?? BUSINESS_NAME);
    html = setMeta(html, 'name', 'twitter:image', image);
  }

  const head = [
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : '',
    canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : '',
    ...Object.entries(page.jsonLd ?? {}).map(
      // Mismo atributo que SeoService: Angular los quita y pone los suyos, sin duplicar.
      ([key, data]) => `<script type="application/ld+json" data-seo-jsonld="${escapeHtml(key)}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
    )
  ].filter(Boolean);

  if (head.length > 0) {
    html = html.replace('</head>', () => '  ' + head.join('\n  ') + '\n</head>');
  }

  if (page.body) {
    // Dentro de <app-root>, después del loader: Angular lo reemplaza al arrancar.
    html = html.replace('</app-root>', () => `<main class="seo-fallback">${page.body}</main>\n  </app-root>`);
  }

  return html;
}

function htmlResponse(status, body, cacheControl, extraHeaders = {}) {
  return {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cacheControl, ...extraHeaders },
    body
  };
}

// ---------------------------------------------------------------- respuesta

/**
 * Respuesta para una URL de ficha o categoría: `{ status, headers, body }`.
 *
 * @param {{ originalUrl: string | null, fetchImpl?: typeof fetch, now?: () => number, log?: (message: string) => void }} options
 */
async function getSeoPageResponse({ originalUrl, fetchImpl = fetch, now = Date.now, log = () => {} }) {
  const origin = shellOrigin(originalUrl ?? SITE_URL);
  let shell;

  try {
    shell = await getShell(fetchImpl, origin);
  } catch (error) {
    log(`No se pudo leer el shell: ${error instanceof Error ? error.message : error}`);
    // Sin shell no hay página que mostrar: un reintento en unos segundos lo resuelve.
    return {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': NO_CACHE, 'Retry-After': '30' },
      body: '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>Magic Beauty Cosmetics</title><p>Cargando…</p>'
    };
  }

  let pathname;

  try {
    pathname = new URL(originalUrl).pathname;
  } catch {
    // Sin la URL original no se sabe qué página es: el shell tal cual, nunca un 404.
    log(`URL original ausente o inválida: ${originalUrl}`);
    return htmlResponse(200, shell, NO_CACHE);
  }

  const route = parsePath(pathname);

  if (route.kind === 'catalog') {
    return htmlResponse(200, shell, NO_CACHE);
  }

  try {
    if (route.kind === 'product') {
      const product = await fetchApiJson(fetchImpl, '/catalog/products/' + encodeURIComponent(route.reference));

      return product
        ? htmlResponse(200, renderPage(shell, productPage(product)), PAGE_CACHE)
        : htmlResponse(404, renderPage(shell, notFoundPage('product')), NO_CACHE);
    }

    if (route.kind === 'category') {
      const trail = findTrail(await getCategoryTree(fetchImpl, now), route.slug);

      return trail
        ? htmlResponse(200, renderPage(shell, categoryPage(trail)), PAGE_CACHE)
        : htmlResponse(404, renderPage(shell, notFoundPage('category')), NO_CACHE);
    }

    // Una ruta bajo /catalogo que la app no tiene (p. ej. /catalogo/a/b).
    return htmlResponse(404, renderPage(shell, notFoundPage('unknown')), NO_CACHE);
  } catch (error) {
    log(`API no disponible para ${pathname}: ${error instanceof Error ? error.message : error}`);
    // Nunca 404 ni noindex por una falla: 503 con el shell sin tocar.
    return htmlResponse(503, shell, NO_CACHE, { 'Retry-After': RETRY_AFTER_SECONDS });
  }
}

/** Solo para pruebas: olvida las copias guardadas. */
function resetSeoPageCache() {
  shellCache = null;
  treeCache = null;
}

module.exports = {
  API_BASE_URL,
  API_TIMEOUT_MS,
  SITE_URL,
  getSeoPageResponse,
  parsePath,
  resetSeoPageCache
};
