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
            { path: '', pathMatch: 'full', component: PageStub, data: { portalBanner: PORTAL_BANNERS.home } },
            { path: 'mayoristas', component: PageStub, data: { portalBanner: PORTAL_BANNERS.wholesale } },
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
  // h1 fijo de la portada: no cambia con el banner a la vista.
  expect(Array.from(root.querySelectorAll('h1'), h1 => text(h1 as HTMLElement).trim())).toEqual([
    'Tienda de maquillaje y cosméticos en Cali'
  ]);
  expect(root.querySelector('.home-slide__title')?.tagName).toBe('P');
  expect(root.querySelectorAll('.tabs__link').length).toBe(5);
});

it.each([
  ['/catalogo', 'Catálogo mayorista', 'Encuentra fácilmente'],
  ['/catalogos', 'Nuestros catálogos', 'formato tradicional'],
  ['/pedido', 'Mi pedido siempre contigo', 'envía tu pedido por WhatsApp'],
  ['/mayoristas', 'Maquillaje y cosméticos al por mayor en Cali', 'precios especiales para tu negocio']
])('keeps the campaign banners on %s with the page title below them', async (url, title, description) => {
  const harness = await setup();
  await harness.navigateByUrl(url);
  const element = harness.fixture.nativeElement as HTMLElement;

  expect(element.querySelector('.home-carousel .home-slide')).not.toBeNull();
  expect(element.querySelectorAll('.home-controls__dot').length).toBe(4);
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

it('shows four image banners chosen with dots, plus previous, next and pause controls', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const root = harness.fixture.nativeElement as HTMLElement;
  expect(root.querySelectorAll('.home-controls__dot').length).toBe(4);
  expect(Array.from(root.querySelectorAll('.home-controls__button'), button => button.getAttribute('aria-label'))).toEqual([
    'Banner anterior',
    'Banner siguiente',
    'Pausar el carrusel'
  ]);
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
  expect(Array.from(root.querySelectorAll('.home-slide__details.is-active .home-slide__cta')).map(link => link.getAttribute('href'))).toEqual(['/catalogo', '/catalogos']);
  expect(root.querySelector('.home-slide__title')?.textContent).toBe('Tu belleza, también en grandes cantidades');
});

it('links the store banner to the digital catalog and leaves the payments banner informative only', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const root = harness.fixture.nativeElement as HTMLElement;
  dot(root, 'la tienda').click();
  harness.fixture.detectChanges();
  const storeLinks = Array.from(root.querySelectorAll('.home-slide a, .home-slide__details.is-active a'));
  expect(storeLinks.length).toBe(2);
  for (const link of storeLinks) expect(link.getAttribute('href')).toBe('/catalogo');

  dot(root, 'medios de pago').click();
  harness.fixture.detectChanges();
  expect(root.querySelectorAll('.home-slide a, .home-slide__details.is-active a').length).toBe(0);
  expect(root.querySelector('.home-slide__media img')?.getAttribute('alt')).toContain('transferencias bancarias');
  expect(root.querySelector('.home-slide__title')?.textContent).toBe('Compra fácil y segura');
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

const button = (root: HTMLElement, label: string) => root.querySelector(`.home-controls__button[aria-label="${label}"]`) as HTMLButtonElement;

it('moves between banners with the previous and next buttons, keeping focus on the control', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const root = harness.fixture.nativeElement as HTMLElement;
  const next = button(root, 'Banner siguiente');
  next.focus();
  next.click();
  harness.fixture.detectChanges();
  expect(slideId(root)).toBe('catalogs');
  // Los controles viven fuera de la diapositiva: cambiar de banner no los destruye.
  expect(button(root, 'Banner siguiente')).toBe(next);
  button(root, 'Banner anterior').click();
  button(root, 'Banner anterior').click();
  harness.fixture.detectChanges();
  expect(slideId(root)).toBe('payments');
});

it('stops rotating while paused and announces changes only then', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  try {
    const harness = await setup();
    await harness.navigateByUrl('/');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    const viewport = () => root.querySelector('.home-carousel__viewport')!.getAttribute('aria-live');
    expect(viewport()).toBe('off');

    button(root, 'Pausar el carrusel').click();
    harness.fixture.detectChanges();
    expect(viewport()).toBe('polite');
    vi.advanceTimersByTime(20000);
    harness.fixture.detectChanges();
    expect(slideId(root)).toBe('calendars');

    button(root, 'Reanudar el carrusel').click();
    vi.advanceTimersByTime(7000);
    harness.fixture.detectChanges();
    expect(slideId(root)).toBe('catalogs');
  } finally {
    vi.useRealTimers();
  }
});

it('pauses while the mouse is over the carousel', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  try {
    const harness = await setup();
    await harness.navigateByUrl('/');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    const root = harness.fixture.nativeElement as HTMLElement;
    root.querySelector('.home-carousel')!.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(20000);
    harness.fixture.detectChanges();
    expect(slideId(root)).toBe('calendars');
  } finally {
    vi.useRealTimers();
  }
});

it('keeps every banner text in the page so changing banner does not move the content', async () => {
  const harness = await setup();
  await harness.navigateByUrl('/');
  const root = harness.fixture.nativeElement as HTMLElement;
  const details = Array.from(root.querySelectorAll('.home-details .home-slide__details'));
  expect(details.length).toBe(4);
  expect(details.filter(item => item.classList.contains('is-active')).length).toBe(1);
  expect(details.filter(item => item.getAttribute('aria-hidden') === 'true').length).toBe(3);
  dot(root, 'catálogos').click();
  harness.fixture.detectChanges();
  expect(root.querySelectorAll('.home-details .home-slide__details').length).toBe(4);
  expect(root.querySelector('.home-slide__details.is-active .home-slide__cta')?.getAttribute('href')).toBe('/catalogo');
});
