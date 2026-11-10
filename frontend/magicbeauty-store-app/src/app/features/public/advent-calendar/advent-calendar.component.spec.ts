import { TestBed } from '@angular/core/testing';
import { AdventCalendarComponent } from './advent-calendar.component';

async function setup() {
  const fixture = TestBed.createComponent(AdventCalendarComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

it('shows four calendars including sold-out Trendy with their supplied photographs', async () => {
  const fixture = await setup();
  const root = fixture.nativeElement as HTMLElement;
  expect(Array.from(root.querySelectorAll('.calendar-card')).map(card => card.getAttribute('data-calendar')))
    .toEqual(['trendy', 'purpure', 'bloomshell', 'magic-beauty']);
  expect(root.querySelectorAll('.photo-pending').length).toBe(0);
  expect(root.querySelectorAll('.calendar-gallery').length).toBe(4);
  expect(root.querySelector('h1')?.textContent).toContain('Calendarios de Adviento');
  expect(root.querySelectorAll('.calendar-gallery__image').length).toBe(4);
});

it('preserves the confirmed retail, deposit and wholesale conditions', async () => {
  const fixture = await setup();
  const cards = fixture.nativeElement.querySelectorAll('.calendar-card') as NodeListOf<HTMLElement>;
  expect(cards[0].textContent).toContain('Agotado');
  expect(cards[0].querySelector('.retail-prices')).toBeNull();
  expect(cards[0].querySelector('.calendar-card__cta')).toBeNull();
  expect(cards[0].querySelector('.trendy-follow')).not.toBeNull();
  for (const amount of ['140.000', '100.000', '125.000', '3 unidades']) expect(cards[1].textContent).toContain(amount);
  for (const card of [cards[2], cards[3]]) {
    expect(card.textContent).toContain('Próximamente');
    expect(card.textContent).toContain('Precio pendiente');
    expect(card.querySelector('.retail-prices')).toBeNull();
  }
});

it('opens individual WhatsApp requests without promising automatic notifications', async () => {
  const fixture = await setup();
  const links = fixture.nativeElement.querySelectorAll('.calendar-card__cta') as NodeListOf<HTMLAnchorElement>;
  expect(links.length).toBe(3);
  for (const [i, name] of ['Purpure', 'Bloomshell', 'Magic Beauty Cosmetics'].entries()) {
    const url = new URL(links[i].href);
    expect(url.hostname).toBe('wa.me');
    expect(url.pathname).toBe('/573127381185');
    expect(url.searchParams.get('text')).toContain(name);
    expect(links[i].rel).toContain('noopener');
    expect(links[i].target).toBe('_blank');
    expect(url.searchParams.get('text')).toContain(i === 0 ? 'mayorista' : 'lanzamiento');
  }
  expect(links[1].textContent).toContain('Consultar lanzamiento');
});

it('explains four steps and the five condition categories with the confirmed safeguards', async () => {
  const fixture = await setup();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelectorAll('.reservation-step').length).toBe(4);
  expect(root.querySelectorAll('.campaign-condition').length).toBe(5);
  const text = root.textContent ?? '';
  for (const condition of ['3 días calendario', 'No se permiten abonos adicionales', 'anticipo completo', 'no implica la pérdida automática']) expect(text).toContain(condition);
  expect(root.querySelector('.campaign-hero__cta')?.getAttribute('href')).toBe('#coleccion');
});

it('changes each gallery independently and wraps between actual images', async () => {
  const fixture = await setup();
  const root = fixture.nativeElement as HTMLElement;
  const trendy = root.querySelector('[data-calendar="trendy"]')!;
  const purpure = root.querySelector('[data-calendar="purpure"]')!;
  const image = (card: Element) => card.querySelector('.calendar-gallery__image')?.getAttribute('src');
  expect(image(trendy)).toContain('trendy-1.webp');
  expect(image(purpure)).toContain('purpure-1.webp');
  (trendy.querySelector('[aria-label="Imagen siguiente de Trendy"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  expect(image(trendy)).toContain('trendy-2.webp');
  expect(image(purpure)).toContain('purpure-1.webp');
  (trendy.querySelector('[aria-label="Ver imagen 3 de Trendy"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  expect(image(trendy)).toContain('trendy-3.webp');
  (trendy.querySelector('[aria-label="Imagen siguiente de Trendy"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  expect(image(trendy)).toContain('trendy-1.webp');
  expect(root.querySelector('[data-calendar="magic-beauty"]')?.querySelectorAll('.calendar-gallery__thumbnail').length).toBe(3);
  const magic = root.querySelector('[data-calendar="magic-beauty"]')!;
  (magic.querySelector('[aria-label="Ver imagen 2 de Magic Beauty Cosmetics"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  expect(image(magic)).toContain('magic-beauty-2.webp');
  expect(magic.textContent).toContain('Imagen conceptual');
});

it('invites followers after the four calendars using the configured official Instagram', async () => {
  const { STORE_SOCIAL_LINKS } = await import('../../../core/constants/store-contact');
  const official = STORE_SOCIAL_LINKS.find(link => link.name === 'Instagram')!.url;
  const fixture = await setup();
  const root = fixture.nativeElement as HTMLElement;
  const section = root.querySelector('.campaign-social')!;
  expect(section).not.toBeNull();
  expect(root.querySelector('.campaign-collection')!.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(section.compareDocumentPosition(root.querySelector('.campaign-how')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(section.querySelector('h2')?.textContent).toBe('¡Trendy se agotó! Pero la magia continúa…');
  expect(section.textContent).toContain('Los calendarios de Adviento están causando sensación. Síguenos en nuestras redes sociales y entérate de las novedades de Purpure, Bloomshell y nuestro calendario exclusivo Magic Beauty');
  const main = section.querySelector('a')!;
  const secondary = root.querySelector('[data-calendar="trendy"] .trendy-follow')!;
  expect(main.textContent).toContain('Síguenos en Instagram');
  expect(secondary.textContent).toContain('¿No alcanzaste? Síguenos para conocer novedades');
  for (const link of [main, secondary]) {
    expect(link.getAttribute('href')).toBe(official);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  }
  expect(section.querySelector('form')).toBeNull();
  expect(root.querySelectorAll('.calendar-card').length).toBe(4);
});
