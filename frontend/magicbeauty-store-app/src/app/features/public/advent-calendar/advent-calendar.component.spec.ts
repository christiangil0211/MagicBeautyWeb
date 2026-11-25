import { TestBed } from '@angular/core/testing';
import { AdventCalendarComponent } from './advent-calendar.component';

async function setup() {
  const fixture = TestBed.createComponent(AdventCalendarComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

it('presents only the Magic Beauty calendar with its real photographs', async () => {
  const root = await setup();
  expect(root.querySelector('h1')?.textContent).toContain('Calendario de Adviento Magic Beauty');
  const images = Array.from(root.querySelectorAll('img'), image => image.getAttribute('src'));
  expect(images).toEqual([
    '/images/campaigns/calendars/magic-beauty-portada.jpg',
    '/images/campaigns/calendars/magic-beauty-cajitas.jpg',
    '/images/campaigns/calendars/magic-beauty-productos.jpg',
    '/images/campaigns/calendars/magic-beauty-presentacion.jpg'
  ]);
  for (const image of Array.from(root.querySelectorAll('img'))) expect(image.getAttribute('alt')).toBeTruthy();
  expect(root.textContent).not.toContain('conceptual');
});

it('quotes the calendar by WhatsApp from the hero and the FAQ', async () => {
  const root = await setup();
  const links = Array.from(root.querySelectorAll('a.campaign-button')) as HTMLAnchorElement[];
  expect(links.length).toBe(2);
  for (const link of links) {
    const url = new URL(link.href);
    expect(url.hostname).toBe('wa.me');
    expect(url.searchParams.get('text')).toContain('Calendario de Adviento Magic Beauty');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  }
  expect(links[0].textContent).toContain('Cotiza el tuyo por WhatsApp');
});

it('tells visitors the other brands are sold out without offering them', async () => {
  const root = await setup();
  const banner = root.querySelector('.campaign-other-brands')!;
  expect(banner.textContent).toContain('Trendy, Purpure y Bloomshell');
  expect(banner.textContent).toContain('Agotados');
  expect(banner.querySelector('a')).toBeNull();
  expect(root.querySelector('.calendar-card')).toBeNull();
});

it('orders the sections as approved, with the other brands at the end', async () => {
  const root = await setup();
  expect(Array.from(root.querySelectorAll('h2'), h2 => h2.id)).toEqual([
    'special-title', 'how-title', 'inside-title', 'faq-title', 'other-brands-title'
  ]);
});

it('opens WhatsApp or Instagram from the icons of the first step', async () => {
  const { STORE_SOCIAL_LINKS } = await import('../../../core/constants/store-contact');
  const instagram = STORE_SOCIAL_LINKS.find(link => link.name === 'Instagram')!.url;
  const root = await setup();
  const first = root.querySelector('.reservation-step')!;
  expect(first.querySelector('h3')?.textContent).toContain('WhatsApp o Instagram');
  const links = Array.from(first.querySelectorAll('a.reservation-step__icon--link')) as HTMLAnchorElement[];
  expect(links.map(link => link.getAttribute('aria-label'))).toEqual(['Escríbenos por WhatsApp', 'Escríbenos por Instagram']);
  expect(new URL(links[0].href).hostname).toBe('wa.me');
  expect(links[1].getAttribute('href')).toBe(instagram);
  for (const link of links) {
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  }
  // Los demás pasos solo informan.
  expect(root.querySelectorAll('.reservation-step a').length).toBe(2);
});

it('explains the steps and answers the frequent questions', async () => {
  const root = await setup();
  expect(root.querySelectorAll('.reservation-step').length).toBe(4);
  expect(root.querySelectorAll('.campaign-question').length).toBe(6);
  expect(root.querySelector('.campaign-features')?.textContent).toContain('Personalízalo a tu medida');
  expect(root.querySelector('.campaign-features')?.textContent).toContain('lo armamos según lo que quieras invertir');
});
