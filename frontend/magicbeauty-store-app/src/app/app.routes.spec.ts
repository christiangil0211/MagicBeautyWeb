import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';

async function navigateAs(harness: RouterTestingHarness, url: string, authenticated = false) {
  let settled = false;
  const navigation = harness.navigateByUrl(url);
  void navigation.then(() => { settled = true; }, () => { settled = true; });
  const answerSession = () => TestBed.inject(HttpTestingController)
    .match(request => request.url.endsWith('/auth/session'))
    .forEach(request => request.flush({ isAuthenticated: authenticated, displayName: authenticated ? 'Admin' : null, canManageStore: authenticated }));
  while (!settled) {
    answerSession();
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  answerSession();
  return navigation;
}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting()
    ]
  });
}

/** Responde como anónimo a la consulta de sesión que hacen el guard y el layout. */
function answerAnonymousSession(): void {
  TestBed.inject(HttpTestingController)
    .match(request => request.url.endsWith('/auth/session'))
    .forEach(request => request.flush({ isAuthenticated: false, displayName: null, canManageStore: false }));
}

it.each([
  ['/productos?q=labial', '/catalogo?q=labial'],
  ['/productos/ACO011', '/catalogo/ACO011'],
  ['/categoria/labios', '/catalogo?categoria=labios'],
  ['/nuevo', '/']
])('redirects %s to %s', async (from, to) => {
  setup();
  const harness = await RouterTestingHarness.create();
  await navigateAs(harness, from);
  expect(TestBed.inject(Router).url).toBe(to);
});

it.each(['/', '/catalogo', '/catalogos', '/pedido', '/catalogo/ACO011'])('serves the portal route %s', async url => {
  setup();
  const harness = await RouterTestingHarness.create();
  await navigateAs(harness, url);
  expect(TestBed.inject(Router).url).toBe(url);
});

it.each(['/admin/products', '/admin/catalogs'])('keeps %s behind the guard for anonymous visitors', async url => {
  setup();
  const harness = await RouterTestingHarness.create();
  const navigation = harness.navigateByUrl(url);
  await new Promise(resolve => setTimeout(resolve));
  answerAnonymousSession();
  await navigation;
  expect(TestBed.inject(Router).url).toBe('/?login=1&returnUrl=' + encodeURIComponent(url));
});


it.each(['/categoria/maquillaje', '/productos', '/productos/ACO011'])('keeps authenticated store navigation outside the wholesale portal at %s', async url => {
  setup();
  const harness = await RouterTestingHarness.create();
  await navigateAs(harness, url, true);
  expect(TestBed.inject(Router).url).toBe(url);
  const element = harness.fixture.nativeElement as HTMLElement;
  expect(element.querySelector('.hero__title')?.textContent).toContain('ESENCIA');
  expect(element.querySelector('app-portal-shell')).toBeNull();
  expect(element.querySelector('.store-menu__link--portal.active')).toBeNull();
  await navigateAs(harness, '/catalogo', true);
  expect(element.querySelector('app-portal-shell')).not.toBeNull();
  expect(element.querySelector('.banner__title')?.textContent).toContain('mayorista');
});


it('highlights the parent category when browsing an authenticated subcategory', async () => {
  setup();
  const harness = await RouterTestingHarness.create();
  await navigateAs(harness, '/categoria/rostro', true);
  TestBed.inject(HttpTestingController).match(request => request.url.endsWith('/categories/menu'))
    .forEach(request => request.flush([{ id: 2, name: 'Maquillaje', slug: 'maquillaje', children: [
      { id: 4, name: 'Rostro', slug: 'rostro', children: [] }
    ] }]));
  await harness.fixture.whenStable();
  harness.fixture.detectChanges();
  const element = harness.fixture.nativeElement as HTMLElement;
  expect(element.querySelector('.store-menu__link.active')?.textContent).toContain('Maquillaje');
  expect(element.querySelector('.store-menu__link--portal.active')).toBeNull();
});


it('returns to wholesale benefits after login and category navigation', async () => {
  setup();
  const harness = await RouterTestingHarness.create();
  await navigateAs(harness, '/categoria/maquillaje', true);
  await navigateAs(harness, '/', true);
  const element = harness.fixture.nativeElement as HTMLElement;
  expect(TestBed.inject(Router).url).toBe('/');
  expect(element.querySelector('app-store-layout')).toBeNull();
  expect(element.querySelector('app-portal-shell')).not.toBeNull();
  expect(element.querySelector('.banner__image')?.getAttribute('src')).toBe('/images/portal/banner-beneficios.jpg');
  expect(element.querySelector('.store-menu__link--portal.active')).not.toBeNull();
});


it('shows the full store home and header search for an authenticated visitor', async () => {
  setup();
  const harness = await RouterTestingHarness.create();
  await navigateAs(harness, '/inicio', true);
  const element = harness.fixture.nativeElement as HTMLElement;
  expect(TestBed.inject(Router).url).toBe('/inicio');
  expect(element.querySelector('.shop-by-category')).not.toBeNull();
  expect(element.querySelector('.desktop-search')).not.toBeNull();
  expect(element.querySelector('app-portal-shell')).toBeNull();
});

it('keeps anonymous visitors in the wholesale portal when opening the store home', async () => {
  setup();
  const harness = await RouterTestingHarness.create();
  await navigateAs(harness, '/inicio');
  expect(TestBed.inject(Router).url).toBe('/');
  expect(harness.fixture.nativeElement.querySelector('app-portal-shell')).not.toBeNull();
  expect(harness.fixture.nativeElement.querySelector('.desktop-search')).toBeNull();
});
