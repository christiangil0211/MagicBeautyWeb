/**
 * Sitemap del sitio servido bajo su propio dominio.
 *
 * El XML lo genera el API (.NET), que es quien conoce los productos y las
 * categorias activos. Azure Static Web Apps no puede reescribir una ruta hacia
 * otro host, asi que esta funcion lo pide al API y lo devuelve tal cual: Google
 * lo lee en https://www.magicbeautycosmetics.com/sitemap.xml.
 *
 * Este archivo no depende del SDK de Azure Functions para poder probarlo solo.
 */

/** Debe ser el host de apiBaseUrl (src/environments/environment.production.ts). */
const SITEMAP_SOURCE_URL =
  'https://api-magic-beauty-g6fpcwbzaghbgjcu.centralus-01.azurewebsites.net/sitemap.xml';

/** El API puede tardar en despertar; las funciones de Static Web Apps cortan a los 45 s. */
const SOURCE_TIMEOUT_MS = 35_000;

/** Durante este tiempo se reutiliza la ultima respuesta buena sin volver a consultar el API. */
const FRESH_FOR_MS = 10 * 60 * 1000;

const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600'
};

/** Ultimo sitemap valido de esta instancia: evita un error si el API falla un momento. */
let lastGood = null;

function isSitemap(body) {
  return typeof body === 'string' && body.includes('<urlset') && body.trimEnd().endsWith('</urlset>');
}

async function fetchSitemap(fetchImpl) {
  const response = await fetchImpl(SITEMAP_SOURCE_URL, {
    headers: { Accept: 'application/xml' },
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
  });

  if (response.status !== 200) {
    throw new Error(`El API respondio ${response.status}`);
  }

  const body = await response.text();

  // Nunca se reenvia algo que no sea un sitemap (una pagina de error, HTML, un XML cortado).
  if (!isSitemap(body)) {
    throw new Error('El API no devolvio un sitemap valido');
  }

  return body;
}

/**
 * Respuesta para /sitemap.xml: `{ status, headers, body }`.
 *
 * @param {{ fetchImpl?: typeof fetch, now?: () => number, log?: (message: string) => void }} [options]
 */
async function getSitemapResponse({ fetchImpl = fetch, now = Date.now, log = () => {} } = {}) {
  if (lastGood && now() - lastGood.at < FRESH_FOR_MS) {
    return { status: 200, headers: XML_HEADERS, body: lastGood.body };
  }

  try {
    const body = await fetchSitemap(fetchImpl);

    lastGood = { body, at: now() };

    return { status: 200, headers: XML_HEADERS, body };
  } catch (error) {
    log(`No se pudo leer el sitemap del API: ${error instanceof Error ? error.message : error}`);

    if (lastGood) {
      return { status: 200, headers: XML_HEADERS, body: lastGood.body };
    }

    // Sin copia que ofrecer: un 503 le dice al buscador que vuelva a intentarlo, sin HTML.
    return {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '120', 'Cache-Control': 'no-store' },
      body: 'Sitemap no disponible temporalmente.'
    };
  }
}

/** Solo para pruebas: olvida la copia guardada. */
function resetSitemapCache() {
  lastGood = null;
}

module.exports = { SITEMAP_SOURCE_URL, FRESH_FOR_MS, getSitemapResponse, resetSitemapCache };
