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

it('links the complete campaign banner to the calendar landing on the public home', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const root = harness.fixture.nativeElement as HTMLElement;
  const link = root.querySelector('.home-slide__link');
  expect(link?.getAttribute('href')).toBe('/calendarios-de-adviento');
  expect(link?.querySelector('img')?.getAttribute('src')).toBe('/images/campaigns/banner-calendario-magic-beauty-2026.jpg');
  expect(root.querySelectorAll('h1').length).toBe(1);
  expect(root.querySelector('.home-slide__title')?.tagName).toBe('H1');
  expect(root.querySelector('.page-heading')).toBeNull();
  expect(root.querySelectorAll('.tabs__link').length).toBe(4);
});

it.each([
  ['/catalogo', 'Catálogo mayorista', 'Encuentra fácilmente'],
  ['/catalogos', 'Nuestros catálogos', 'formato tradicional'],
  ['/pedido', 'Mi pedido siempre contigo', 'envía tu pedido por WhatsApp']
])('keeps the campaign banners on %s with the page title below them', async (url, title, description) => {
  const harness = await setup();
  await harness.navigateByUrl(url);
  const element = harness.fixture.nativeElement as HTMLElement;

  expect(element.querySelector('.home-carousel .home-slide')).not.toBeNull();
  expect(element.querySelectorAll('.home-dots__dot').length).toBe(4);
  // Un solo h1 por página: el de la página; el título del banner activo no compite.
  expect(Array.from(element.querySelectorAll('h1'), h1 => text(h1 as HTMLElement).trim())).toEqual([title]);
  expect(element.querySelector('.home-slide__title')?.tagName).toBe('P');
  expect(element.querySelector('.page-heading__text')?.textContent).toContain(description);
});

it('keeps the tabs without a banner on the product detail', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/catalogo/ACO011');
  const element = harness.fixture.nativeElement as HTMLElement;

  expect(element.querySelector('.home-carousel')).toBeNull();
  expect(element.querySelector('h1')).toBeNull();
  expect(element.querySelector('.tabs__link.active .tabs__label')?.textContent?.trim()).toBe('Catálogo digital');
});

const slideId = (root: HTMLElement) => root.querySelector('.home-slide')?.getAttribute('data-slide');
const dot = (root: HTMLElement, name: string) => root.querySelector(`[aria-label="Ir al banner de ${name}"]`) as HTMLButtonElement;

it('shows four image banners chosen with dots only, without arrows or pause buttons', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const root = harness.fixture.nativeElement as HTMLElement;
  expect(root.querySelectorAll('.home-dots__dot').length).toBe(4);
  expect(root.querySelectorAll('.home-carousel button').length).toBe(4);
  for (const [name, id, src] of [
    ['catálogos', 'catalogs', 'banner-catalogo-mayorista.webp'],
    ['la tienda', 'store', 'banner-tienda-magic-beauty.webp'],
    ['medios de pago', 'payments', 'banner-medios-de-pago.webp'],
    ['calendarios', 'calendars', 'banner-calendario-magic-beauty-2026.jpg']
  ]) {
    dot(root, name).click();
    harness.fixture.detectChanges();
    expect(slideId(root)).toBe(id);
    expect(root.querySelector('.home-slide__media img')?.getAttribute('src')).toBe('/images/campaigns/' + src);
    expect(dot(root, name).getAttribute('aria-current')).toBe('true');
    expect(root.querySelectorAll('h1').length).toBe(1);
  }
});

it('keeps both catalog links on the wholesale banner and adds them as real buttons for mobile', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const root = harness.fixture.nativeElement as HTMLElement;
  dot(root, 'catálogos').click();
  harness.fixture.detectChanges();
  const hotspots = Array.from(root.querySelectorAll('.home-slide__hotspot'));
  expect(hotspots.map(link => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual([
    ['Ver catálogo digital', '/catalogo'],
    ['Ver catálogo tradicional', '/catalogos']
  ]);
  expect(Array.from(root.querySelectorAll('.home-slide__cta')).map(link => link.getAttribute('href'))).toEqual(['/catalogo', '/catalogos']);
  expect(root.querySelector('h1')?.textContent).toBe('Tu belleza, también en grandes cantidades');
});

it('links the store banner to the digital catalog and leaves the payments banner informative only', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const root = harness.fixture.nativeElement as HTMLElement;
  dot(root, 'la tienda').click();
  harness.fixture.detectChanges();
  const storeLinks = Array.from(root.querySelectorAll('.home-slide a'));
  expect(storeLinks.length).toBe(2);
  for (const link of storeLinks) expect(link.getAttribute('href')).toBe('/catalogo');

  dot(root, 'medios de pago').click();
  harness.fixture.detectChanges();
  expect(root.querySelectorAll('.home-slide a').length).toBe(0);
  expect(root.querySelector('.home-slide__media img')?.getAttribute('alt')).toContain('transferencias bancarias');
  expect(root.querySelector('h1')?.textContent).toBe('Compra fácil y segura');
});

it('changes slide on a touch swipe', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const root = harness.fixture.nativeElement as HTMLElement;
  const swipe = (from: number, to: number) => {
    const media = root.querySelector('.home-slide__media')!;
    media.dispatchEvent(Object.assign(new MouseEvent('pointerdown', { clientX: from, bubbles: true }), { pointerType: 'touch' }));
    media.dispatchEvent(Object.assign(new MouseEvent('pointerup', { clientX: to, bubbles: true }), { pointerType: 'touch' }));
    harness.fixture.detectChanges();
  };
  swipe(300, 100);
  expect(slideId(root)).toBe('catalogs');
  swipe(100, 300);
  expect(slideId(root)).toBe('calendars');
  swipe(100, 300);
  expect(slideId(root)).toBe('payments');
});

it('rotates by itself and keeps rotating after a dot is clicked', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  try {
    const harness = await setup();
    await harness.navigateByUrl('/');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    expect(slideId(root)).toBe('calendars');
    vi.advanceTimersByTime(7000);
    harness.fixture.detectChanges();
    expect(slideId(root)).toBe('catalogs');
    dot(root, 'medios de pago').click();
    vi.advanceTimersByTime(3000);
    harness.fixture.detectChanges();
    expect(slideId(root)).toBe('payments');
    vi.advanceTimersByTime(4000);
    harness.fixture.detectChanges();
    expect(slideId(root)).toBe('calendars');
  } finally {
    vi.useRealTimers();
  }
});

it('keeps rotating the campaign banners on the catalog tab', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  try {
    const harness = await setup();
    await harness.navigateByUrl('/catalogo');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    expect(slideId(root)).toBe('calendars');
    vi.advanceTimersByTime(7000);
    harness.fixture.detectChanges();
    expect(slideId(root)).toBe('catalogs');
  } finally {
    vi.useRealTimers();
  }
});
