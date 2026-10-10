import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PORTAL_BANNERS } from './portal-navigation';
import { PortalShellComponent } from './portal-shell.component';

@Component({ template: '<p class="page">Contenido</p>' })
class PageStub {}

async function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: '',
          component: PortalShellComponent,
          children: [
            { path: '', pathMatch: 'full', component: PageStub, data: { portalBanner: PORTAL_BANNERS.benefits } },
            { path: 'catalogo', component: PageStub, data: { portalBanner: PORTAL_BANNERS.digitalCatalog } },
            { path: 'catalogos', component: PageStub, data: { portalBanner: PORTAL_BANNERS.traditionalCatalogs } },
            { path: 'pedido', component: PageStub, data: { portalBanner: PORTAL_BANNERS.order } },
            { path: 'catalogo/:reference', component: PageStub }
          ]
        }
      ])
    ]
  });

  return RouterTestingHarness.create();
}

const text = (element: HTMLElement) => (element.textContent ?? '').replace(/\s+/g, ' ');

it('shows the benefits banner with its image and buttons to both catalogs', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const element = harness.fixture.nativeElement as HTMLElement;

  expect(text(element)).toContain('Hazte mayorista');
  expect(text(element.querySelector('.banner__title')!)).toContain('Tu belleza, también en grandes cantidades');
  expect(element.querySelector('.banner__image')?.getAttribute('src')).toBe('/images/portal/banner-beneficios.jpg');

  const buttons = Array.from(element.querySelectorAll('a.banner__button')).map(link => [
    link.textContent?.trim(),
    link.getAttribute('href')
  ]);
  expect(buttons).toEqual([
    ['Ver catálogo digital', '/catalogo'],
    ['Ver catálogo tradicional', '/catalogos']
  ]);

  const tabs = Array.from(element.querySelectorAll('.tabs__label')).map(tab => tab.textContent?.trim());
  expect(tabs).toEqual(['Beneficios', 'Catálogo digital', 'Catálogo tradicional', 'Mi pedido']);
  expect(element.querySelector('.tabs__link.active .tabs__label')?.textContent?.trim()).toBe('Beneficios');
});

it.each([
  ['/catalogo', 'Catálogo mayorista', 'Explorar catálogo digital', 'banner-catalogo-digital.jpg'],
  ['/catalogos', 'Nuestros catálogos', 'Ver catálogos', 'banner-catalogos.jpg'],
  ['/pedido', 'Mi pedido siempre contigo', 'Revisar mi pedido', 'banner-pedido.jpg']
])('shows the approved banner on %s', async (url, title, action, image) => {
  const harness = await setup();
  await harness.navigateByUrl(url);
  const element = harness.fixture.nativeElement as HTMLElement;

  expect(text(element.querySelector('.banner__title')!).trim()).toBe(title);
  expect(element.querySelector('button.banner__button')?.textContent?.trim()).toBe(action);
  expect(element.querySelector('.banner__image')?.getAttribute('src')).toBe('/images/portal/' + image);
});

it('scrolls to the tab content from the banner button without leaving the tab', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/pedido');
  const element = harness.fixture.nativeElement as HTMLElement;
  const content = element.querySelector('.portal-content') as HTMLElement;
  let scrolled = false;
  content.scrollIntoView = () => (scrolled = true);

  (element.querySelector('button.banner__button') as HTMLButtonElement).click();

  expect(scrolled).toBe(true);
  expect(TestBed.inject(Router).url).toBe('/pedido');
});

it('keeps the tabs without a banner on the product detail', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/catalogo/ACO011');
  const element = harness.fixture.nativeElement as HTMLElement;

  expect(element.querySelector('.banner')).toBeNull();
  expect(element.querySelector('.tabs__link.active .tabs__label')?.textContent?.trim()).toBe('Catálogo digital');
});
