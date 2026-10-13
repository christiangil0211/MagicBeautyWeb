const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const { FRESH_FOR_MS, SITEMAP_SOURCE_URL, getSitemapResponse, resetSitemapCache } = require('./sitemap-proxy');

const SITEMAP = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '  <url><loc>https://www.magicbeautycosmetics.com/</loc></url>',
  '  <url><loc>https://www.magicbeautycosmetics.com/catalogo/ACE009</loc><lastmod>2026-10-09</lastmod></url>',
  '</urlset>'
].join('\n');

/** API simulado: responde lo que se le indique y cuenta las llamadas. */
function api(...replies) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];

    if (reply instanceof Error) {
      throw reply;
    }

    return { status: reply.status ?? 200, text: async () => reply.body };
  };

  return { fetchImpl, calls };
}

beforeEach(() => resetSitemapCache());

test('returns the API sitemap unchanged, as XML', async () => {
  const { fetchImpl, calls } = api({ body: SITEMAP });

  const response = await getSitemapResponse({ fetchImpl });

  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'application/xml; charset=utf-8');
  assert.equal(response.headers['Cache-Control'], 'public, max-age=3600');
  assert.equal(response.body, SITEMAP);
  assert.equal(calls[0].url, SITEMAP_SOURCE_URL);
  assert.ok(calls[0].init.signal, 'la consulta al API lleva limite de tiempo');
});

test('reads the sitemap from the API host over HTTPS', () => {
  const url = new URL(SITEMAP_SOURCE_URL);

  assert.equal(url.protocol, 'https:');
  assert.equal(url.pathname, '/sitemap.xml');
  assert.notEqual(url.hostname, 'www.magicbeautycosmetics.com', 'pedirselo al propio sitio seria un bucle');
});

test('reuses a recent copy instead of calling the API on every request', async () => {
  const { fetchImpl, calls } = api({ body: SITEMAP });
  let clock = 1_000;

  await getSitemapResponse({ fetchImpl, now: () => clock });
  clock += FRESH_FOR_MS - 1;
  const response = await getSitemapResponse({ fetchImpl, now: () => clock });

  assert.equal(response.body, SITEMAP);
  assert.equal(calls.length, 1);
});

test('asks the API again once the copy is old, so new products show up', async () => {
  const updated = SITEMAP.replace('ACE009', 'NUEVO01');
  const { fetchImpl, calls } = api({ body: SITEMAP }, { body: updated });
  let clock = 1_000;

  await getSitemapResponse({ fetchImpl, now: () => clock });
  clock += FRESH_FOR_MS + 1;
  const response = await getSitemapResponse({ fetchImpl, now: () => clock });

  assert.equal(calls.length, 2);
  assert.equal(response.body, updated);
});

for (const [name, reply] of [
  ['the API is down', new Error('ECONNREFUSED')],
  ['the API answers an error', { status: 500, body: '{"error":"x"}' }],
  ['the API answers HTML', { body: '<!doctype html><html><body>Cargando</body></html>' }],
  ['the XML is cut short', { body: SITEMAP.replace('</urlset>', '') }]
]) {
  test(`answers 503 without HTML when ${name} and there is no copy`, async () => {
    const logged = [];
    const response = await getSitemapResponse({ fetchImpl: api(reply).fetchImpl, log: message => logged.push(message) });

    assert.equal(response.status, 503);
    assert.equal(response.headers['Content-Type'], 'text/plain; charset=utf-8');
    assert.equal(response.headers['Retry-After'], '120');
    assert.ok(!response.body.includes('<'));
    assert.equal(logged.length, 1);
  });

  test(`keeps serving the last good sitemap when ${name}`, async () => {
    const { fetchImpl } = api({ body: SITEMAP }, reply);
    let clock = 1_000;

    await getSitemapResponse({ fetchImpl, now: () => clock });
    clock += FRESH_FOR_MS + 1;
    const response = await getSitemapResponse({ fetchImpl, now: () => clock });

    assert.equal(response.status, 200);
    assert.equal(response.headers['Content-Type'], 'application/xml; charset=utf-8');
    assert.equal(response.body, SITEMAP);
  });
}
