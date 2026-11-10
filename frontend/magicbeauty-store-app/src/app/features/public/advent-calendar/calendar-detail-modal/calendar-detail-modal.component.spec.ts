import { TestBed } from '@angular/core/testing';
import { AdventCalendarComponent } from '../advent-calendar.component';

async function setup() {
  const fixture = TestBed.createComponent(AdventCalendarComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;

async function openFrom(fixture: Fixture, id: string, trigger: 'image' | 'name' = 'image') {
  const card = (fixture.nativeElement as HTMLElement).querySelector(`[data-calendar="${id}"]`)!;
  const button = card.querySelector(trigger === 'image' ? '.calendar-gallery__open' : '.calendar-card__open') as HTMLButtonElement;
  button.focus();
  button.click();
  fixture.detectChanges();
  await fixture.whenStable();
  return button;
}

function closeWithButton(fixture: Fixture) {
  (dialog()!.querySelector('.detail__close') as HTMLButtonElement).click();
  fixture.detectChanges();
}

it('opens one reusable dialog for each of the four calendars from the photo or the name', async () => {
  const fixture = await setup();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelector('app-calendar-detail-modal')).toBeNull();
  const expected: [string, string][] = [
    ['trendy', 'Wonderland Luxury 2026'],
    ['purpure', 'Calendario de Adviento 2026'],
    ['bloomshell', 'Calendario de Adviento 2026'],
    ['magic-beauty', 'Nuestro calendario especial']
  ];
  for (const [id, title] of expected) {
    await openFrom(fixture, id, id === 'purpure' ? 'name' : 'image');
    expect(root.querySelectorAll('app-calendar-detail-modal').length).toBe(1);
    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
    expect(dialog()?.getAttribute('data-calendar')).toBe(id);
    expect(dialog()?.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(title);
    closeWithButton(fixture);
    expect(dialog()).toBeNull();
  }
});

it('shows Trendy as sold out with campaign prices and only the Instagram call to action', async () => {
  const fixture = await setup();
  await openFrom(fixture, 'trendy');
  const text = dialog()!.textContent!;
  expect(dialog()!.querySelector('.detail__status')?.textContent).toContain('Agotado');
  for (const value of ['14 productos', '200.000', '120.000', '80.000', '180.000', '3 unidades', '25 de noviembre al 15 de diciembre de 2026', 'no se reciben nuevas separaciones']) {
    expect(text).toContain(value);
  }
  const links = Array.from(dialog()!.querySelectorAll('.detail__actions a')) as HTMLAnchorElement[];
  expect(links.length).toBe(1);
  expect(links[0].href).toContain('instagram.com');
  expect(links[0].textContent).toContain('Síguenos para conocer novedades');
  expect(dialog()!.querySelector('a[href*="wa.me"]')).toBeNull();
});

it('shows Purpure retail and wholesale balances and a WhatsApp separation request', async () => {
  const fixture = await setup();
  await openFrom(fixture, 'purpure');
  const text = dialog()!.textContent!;
  expect(dialog()!.querySelector('.detail__status')?.textContent).toContain('Preventa');
  for (const value of ['140.000', '100.000', '40.000', '125.000', '25.000', '3 unidades', 'Contenido exacto pendiente']) {
    expect(text).toContain(value);
  }
  const whatsapp = dialog()!.querySelector('.detail-button--whatsapp') as HTMLAnchorElement;
  expect(whatsapp.textContent).toContain('Separar por WhatsApp');
  expect(whatsapp.target).toBe('_blank');
  const message = new URL(whatsapp.href).searchParams.get('text')!;
  expect(message).toContain('Purpure');
  expect(message).toContain('mayorista');
});

it('keeps Bloomshell and Magic Beauty pending, without prices, and marks conceptual images', async () => {
  const fixture = await setup();
  const expected: [string, string][] = [['bloomshell', 'Consultar lanzamiento'], ['magic-beauty', 'Consultar nuestro calendario']];
  for (const [id, cta] of expected) {
    await openFrom(fixture, id);
    expect(dialog()!.querySelector('.detail__status')?.textContent).toContain('Próximamente');
    expect(dialog()!.querySelector('.detail-prices--pending')).not.toBeNull();
    expect(dialog()!.querySelector('.detail-wholesale')).toBeNull();
    const whatsapp = dialog()!.querySelector('.detail-button--whatsapp') as HTMLAnchorElement;
    expect(whatsapp.textContent).toContain(cta);
    expect(new URL(whatsapp.href).searchParams.get('text')).toContain('lanzamiento');
    expect(!!dialog()!.querySelector('.detail-gallery__concept')).toBe(id === 'magic-beauty');
    closeWithButton(fixture);
  }
});

it('reuses the landing conditions instead of a second version of the text', async () => {
  const fixture = await setup();
  await openFrom(fixture, 'purpure');
  const conditions = dialog()!.querySelector('.detail-conditions')!;
  for (const condition of fixture.componentInstance.conditions) expect(conditions.textContent).toContain(condition.text);
});

it('starts on the image shown in the card and navigates with arrows, keyboard and thumbnails', async () => {
  const fixture = await setup();
  const card = (fixture.nativeElement as HTMLElement).querySelector('[data-calendar="trendy"]')!;
  (card.querySelector('[aria-label="Imagen siguiente de Trendy"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  await openFrom(fixture, 'trendy');
  const image = () => dialog()!.querySelector('.detail-gallery__image')!.getAttribute('src');
  expect(image()).toContain('trendy-2.webp');
  (dialog()!.querySelector('[aria-label="Imagen siguiente de Trendy"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  expect(image()).toContain('trendy-3.webp');
  dialog()!.querySelector('.detail-gallery')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  fixture.detectChanges();
  expect(image()).toContain('trendy-1.webp');
  (dialog()!.querySelector('[aria-label="Ver imagen 2 de Trendy"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  expect(image()).toContain('trendy-2.webp');
  expect(dialog()!.textContent).toContain('2 de 3');
});

it('locks page scroll, focuses close, closes with Escape or the backdrop and restores focus', async () => {
  const fixture = await setup();
  const overflowBefore = document.body.style.overflow;
  const trigger = await openFrom(fixture, 'bloomshell', 'name');
  expect(document.body.style.overflow).toBe('hidden');
  expect(document.activeElement?.classList.contains('detail__close')).toBe(true);

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  fixture.detectChanges();
  expect(dialog()).toBeNull();
  expect(document.body.style.overflow).toBe(overflowBefore);
  expect(document.activeElement).toBe(trigger);

  await openFrom(fixture, 'bloomshell');
  // Un clic dentro del panel no cierra; uno en el fondo sí.
  dialog()!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  dialog()!.click();
  fixture.detectChanges();
  expect(dialog()).not.toBeNull();
  const backdrop = document.querySelector('.detail-backdrop')!;
  backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  fixture.detectChanges();
  expect(dialog()).toBeNull();
});

it('also opens the detail from the hero previews with mouse or keyboard', async () => {
  const fixture = await setup();
  const previews = (fixture.nativeElement as HTMLElement).querySelectorAll('.calendar-preview') as NodeListOf<HTMLElement>;
  previews[1].click();
  fixture.detectChanges();
  expect(dialog()?.getAttribute('data-calendar')).toBe('purpure');
  closeWithButton(fixture);
  previews[2].focus();
  previews[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  fixture.detectChanges();
  expect(dialog()?.getAttribute('data-calendar')).toBe('bloomshell');
  closeWithButton(fixture);
  expect(document.activeElement).toBe(previews[2]);
});
