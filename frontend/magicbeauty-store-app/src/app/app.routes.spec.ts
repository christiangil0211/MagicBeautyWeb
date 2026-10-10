import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';

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
  await harness.navigateByUrl(from);
  expect(TestBed.inject(Router).url).toBe(to);
});

it.each(['/', '/catalogo', '/catalogos', '/pedido', '/catalogo/ACO011'])('serves the portal route %s', async url => {
  setup();
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
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
