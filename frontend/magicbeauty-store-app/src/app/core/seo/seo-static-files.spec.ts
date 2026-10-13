import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { environment as production } from '../../../environments/environment.production';
import { routes } from '../../app.routes';
import { serverRoutes } from '../../app.routes.server';
import { STORE_SITE_URL } from '../constants/store-contact';
import { SEO_DEFAULTS } from './seo.model';

/** Archivos que se publican tal cual: se leen del disco, como los verá el hosting. */
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('robots.txt', () => {
  const robots = read('public/robots.txt');
  const lines = robots.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));

  it('lets every crawler in and only blocks the back office', () => {
    expect(lines).toContain('User-agent: *');
    expect(lines.filter(line => line.startsWith('Disallow:'))).toEqual(['Disallow: /admin']);
  });

  it('does not block the pages that rely on a noindex tag', () => {
    // Un buscador solo puede leer el noindex de una página que le dejan rastrear.
    expect(robots).not.toMatch(/Disallow:\s*\/(pedido|catalogo)/);
    expect(robots).not.toMatch(/Disallow:\s*\/\s*$/m);
  });

  it('declares the sitemap on the site own domain, where Search Console accepts it', () => {
    const sitemaps = lines.filter(line => line.startsWith('Sitemap:')).map(line => line.replace('Sitemap:', '').trim());

    expect(sitemaps).toEqual([STORE_SITE_URL + '/sitemap.xml']);
  });
});

describe('sitemap.xml', () => {
  const config = JSON.parse(read('public/staticwebapp.config.json')) as {
    platform?: { apiRuntime?: string };
    navigationFallback: { exclude: string[] };
    routes: { route: string; rewrite?: string }[];
  };
  const proxy = read('../storefront-api/src/sitemap-proxy.js');
  const functionApp = JSON.parse(read('../storefront-api/package.json')) as { main: string; dependencies: Record<string, string> };

  it('is answered by the sitemap function, never by the application HTML', () => {
    const index = config.routes.findIndex(item => item.route === '/sitemap.xml');

    expect(config.routes[index]?.rewrite).toBe('/api/sitemap');
    // Las reglas se evalúan en orden y gana la primera: ninguna anterior puede capturarlo.
    expect(config.routes.slice(0, index).some(item => /^\/\*/.test(item.route))).toBe(false);
    expect(config.navigationFallback.exclude.join(' ')).toContain('xml');
    expect(() => read('public/sitemap.xml')).toThrow();
  });

  it('registers the function at /api/sitemap on a supported runtime', () => {
    const registration = read('../storefront-api/src/functions/sitemap.js');

    expect(registration).toContain("route: 'sitemap'");
    expect(registration).toContain("authLevel: 'anonymous'");
    expect(functionApp.main).toBe('src/functions/*.js');
    expect(functionApp.dependencies['@azure/functions']).toMatch(/^\^4\./);
    expect(config.platform?.apiRuntime).toBe('node:20');
  });

  it('reads the sitemap from the same API the store uses', () => {
    const source = /SITEMAP_SOURCE_URL =\s*'([^']+)'/.exec(proxy)?.[1];

    expect(source).toBe(new URL(production.apiBaseUrl).origin + '/sitemap.xml');
  });

  it('deploys the function with the site', () => {
    const workflow = read('../../.github/workflows/azure-static-web-apps-mango-beach-053c1c010.yml');

    expect(workflow).toContain('api_location: "/frontend/storefront-api"');
  });
});

describe('staticwebapp.config.json', () => {
  const config = JSON.parse(read('public/staticwebapp.config.json')) as {
    navigationFallback: { rewrite: string; exclude: string[] };
    routes: { route: string; rewrite?: string; redirect?: string; headers?: Record<string, string> }[];
  };
  const rule = (route: string) => config.routes.find(item => item.route === route);

  it('serves the client-side shell, not the prerendered home, for application routes', () => {
    expect(config.navigationFallback.rewrite).toBe('/index.csr.html');
    const pages = config.routes.filter(item => item.rewrite && item.route !== '/sitemap.xml');

    expect(pages.length).toBeGreaterThan(0);
    expect(pages.every(item => item.rewrite === '/index.csr.html')).toBe(true);
  });

  it('never answers robots.txt or a sitemap with the application HTML', () => {
    const extensions = config.navigationFallback.exclude.join(' ');

    expect(extensions).toContain('txt');
    expect(extensions).toContain('xml');
  });

  it('sends a noindex header for the back office and the order page', () => {
    expect(rule('/admin')?.headers?.['X-Robots-Tag']).toContain('noindex');
    expect(rule('/admin/*')?.headers?.['X-Robots-Tag']).toContain('noindex');
    expect(rule('/pedido')?.headers?.['X-Robots-Tag']).toContain('noindex');
  });

  it('caches hashed bundles for a year but never an HTML document', () => {
    expect(rule('/*.{js,css}')?.headers?.['Cache-Control']).toContain('immutable');
    expect(rule('/media/*')?.headers?.['Cache-Control']).toContain('immutable');
    expect(config.routes.filter(item => item.headers?.['Cache-Control']).some(item => /html|^\/\*?$/.test(item.route))).toBe(false);
  });

  it('adds no redirect that could loop on the home page', () => {
    expect(config.routes.some(item => item.redirect)).toBe(false);
  });
});

describe('index.html', () => {
  const html = read('src/index.html');
  const content = (selector: string) => new RegExp(`<meta ${selector} content="([^"]*)"`).exec(html)?.[1];

  it('carries the brand metadata for visitors that do not run JavaScript', () => {
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe(SEO_DEFAULTS.title);
    expect(content('name="description"')).toBe(SEO_DEFAULTS.description);
    expect(content('property="og:title"')).toBe(SEO_DEFAULTS.title);
    expect(content('property="og:description"')).toBe(SEO_DEFAULTS.description);
    expect(content('property="og:image"')).toBe(STORE_SITE_URL + SEO_DEFAULTS.image);
    expect(content('name="twitter:card"')).toBe('summary_large_image');
    expect(content('name="twitter:image"')).toBe(STORE_SITE_URL + SEO_DEFAULTS.image);
    expect(html).toContain('<html lang="es">');
  });

  it('leaves canonical, og:url and robots to each page', () => {
    // Este archivo se sirve para cualquier URL: un canonical fijo las apuntaría todas al inicio.
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:url');
    expect(html).not.toContain('name="robots"');
  });

  it('sends the root domain to the canonical www origin, keeping the path', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    const visit = (href: string) => {
      const url = new URL(href);
      let target: string | null = null;
      const location = { hostname: url.hostname, pathname: url.pathname, search: url.search, hash: url.hash, replace: (to: string) => (target = to) };

      new Function('location', script)(location);

      return target;
    };

    expect(visit('https://magicbeautycosmetics.com/catalogo/ACE009?x=1#foto')).toBe(STORE_SITE_URL + '/catalogo/ACE009?x=1#foto');
    expect(visit('https://magicbeautycosmetics.com/')).toBe(STORE_SITE_URL + '/');
    // El dominio canónico y las vistas previas de Azure no se redirigen.
    expect(visit('https://www.magicbeautycosmetics.com/catalogo')).toBeNull();
    expect(visit('https://mango-beach-053c1c010-7.centralus.4.azurestaticapps.net/')).toBeNull();
  });

  it('has the social preview image it announces', () => {
    expect(readFileSync(join(process.cwd(), 'public', SEO_DEFAULTS.image)).length).toBeGreaterThan(10_000);
  });
});

describe('prerendered routes', () => {
  const prerendered = serverRoutes.filter(route => route.renderMode !== undefined && route.path !== '**').map(route => route.path);

  it('prerenders only portal pages that exist and are indexable', () => {
    const portal = routes
      .find(route => route.path === '')!
      .children!.flatMap(route => route.children ?? [])
      .filter(route => route.data?.['portalBanner'] && !route.data?.['seo']?.noindex)
      .map(route => route.path);

    expect(prerendered).toEqual(['', 'catalogo', 'catalogos']);
    prerendered.forEach(path => expect(portal).toContain(path));
  });

  it('never prerenders pages built from live prices or stock', () => {
    expect(prerendered.some(path => path.includes(':') || path.includes('pedido') || path.includes('admin'))).toBe(false);
  });
});
