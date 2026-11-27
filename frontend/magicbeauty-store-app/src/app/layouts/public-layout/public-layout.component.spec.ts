import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { CategoryService } from '../../core/services/category.service';
import { CategoryMenuItem } from '../../shared/models/category.model';
import { BRANCH_HOVER_DELAY_MS, PublicLayoutComponent } from './public-layout.component';

async function openMegaMenu(menu: CategoryMenuItem[]) {
  TestBed.configureTestingModule({
    imports: [PublicLayoutComponent],
    providers: [provideRouter([]),
      { provide: AuthService, useValue: {
        canManageStore: signal(false), isAuthenticated: signal(false), session: signal(null), ensureSession: () => of(null),
        priceAudienceKey: signal('anonymous')
      } },
      { provide: CategoryService, useValue: { getMenu: () => of(menu) } }
    ]
  });
  const fixture = TestBed.createComponent(PublicLayoutComponent);
  // El mega menú es navegación del e-commerce: en el portal está apagado.
  fixture.componentRef.setInput('ecommerceNavigation', true);
  await fixture.whenStable();
  fixture.nativeElement.querySelector('.store-menu__item').dispatchEvent(new Event('mouseenter'));
  fixture.detectChanges();
  vi.useFakeTimers();

  /** Mueve el puntero sobre la fila de la categoría y espera la apertura. */
  const hover = (name: string, x = 10, y = 10) => {
    const row = Array.from(fixture.nativeElement.querySelectorAll('.nav-dropdown__row') as NodeListOf<HTMLElement>)
      .find(item => item.querySelector('.nav-dropdown__link')?.textContent?.trim() === name);
    if (!row) throw new Error('No se encontró la fila ' + name);
    row.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }));
    return row;
  };
  const wait = () => {
    vi.advanceTimersByTime(BRANCH_HOVER_DELAY_MS);
    fixture.detectChanges();
  };
  return { fixture, hover, wait };
}

afterEach(() => vi.useRealTimers());

it('opens every nested level on hover and keeps ancestors open', async () => {
  const { fixture, hover, wait } = await openMegaMenu([
    { id: 1, slug: 'root', name: 'Root', children: [
      { id: 2, slug: 'child', name: 'Child', children: [
        { id: 3, slug: 'grandchild', name: 'Grandchild', children: [
          { id: 4, slug: 'leaf', name: 'Leaf', children: [] }
        ] }
      ] }
    ] }
  ]);

  hover('Child', 10, 10);
  wait();
  hover('Grandchild', 10, 40);
  wait();

  expect(fixture.nativeElement.querySelector('.nav-dropdown').textContent).toContain('Leaf');
  expect(fixture.componentInstance.isChildExpanded(2)).toBe(true);
  expect(fixture.componentInstance.isChildExpanded(3)).toBe(true);
});

it('switches between sibling categories like an accordion without closing the menu', async () => {
  const { fixture, hover, wait } = await openMegaMenu([
    { id: 1, slug: 'maquillaje', name: 'Maquillaje', children: [
      { id: 2, slug: 'rostro', name: 'Rostro', children: [
        { id: 21, slug: 'correctores', name: 'Correctores', children: [] },
        { id: 22, slug: 'polvos', name: 'Polvos', children: [] },
        { id: 23, slug: 'bases', name: 'Bases', children: [] }
      ] },
      { id: 3, slug: 'ojos', name: 'Ojos', children: [
        { id: 31, slug: 'sombras', name: 'Sombras', children: [] }
      ] },
      { id: 4, slug: 'labios', name: 'Labios', children: [
        { id: 41, slug: 'labiales', name: 'Labiales', children: [] }
      ] }
    ] }
  ]);
  const component = fixture.componentInstance;

  hover('Rostro', 10, 10);
  wait();
  expect(component.isChildExpanded(2)).toBe(true);

  // Bajar por las subcategorías de Rostro no cierra nada.
  const bases = hover('Bases', 10, 100);
  bases.dispatchEvent(new Event('mouseleave'));
  wait();
  expect(component.isChildExpanded(2)).toBe(true);

  hover('Ojos', 10, 140);
  wait();
  expect(component.isChildExpanded(2)).toBe(false);
  expect(component.isChildExpanded(3)).toBe(true);
  expect(component.openMenuId()).toBe(1);

  // Las filas se desplazan bajo el puntero quieto: ese evento no abre otra rama.
  hover('Labios', 10, 140);
  wait();
  expect(component.isChildExpanded(3)).toBe(true);
  expect(component.isChildExpanded(4)).toBe(false);

  // Cruzar una fila de paso tampoco la abre.
  const labios = hover('Labios', 10, 150);
  labios.dispatchEvent(new Event('mouseleave'));
  wait();
  expect(component.isChildExpanded(4)).toBe(false);
  expect(component.isChildExpanded(3)).toBe(true);
});

it('keeps the menu open when it shrinks under a still pointer and closes it once the pointer moves away', async () => {
  const { fixture, hover, wait } = await openMegaMenu([
    { id: 1, slug: 'maquillaje', name: 'Maquillaje', children: [
      { id: 2, slug: 'rostro', name: 'Rostro', children: [
        { id: 21, slug: 'correctores', name: 'Correctores', children: [] },
        { id: 22, slug: 'polvos', name: 'Polvos', children: [] }
      ] },
      { id: 3, slug: 'ojos', name: 'Ojos', children: [] }
    ] }
  ]);
  const component = fixture.componentInstance;
  const nav = fixture.nativeElement.querySelector('.store-menu') as HTMLElement;

  hover('Rostro', 10, 10);
  wait();
  // Ojos no tiene subcategorías: se cierra Rostro y no se abre nada más.
  hover('Ojos', 10, 140);
  wait();
  expect(component.isChildExpanded(2)).toBe(false);
  expect(fixture.nativeElement.querySelector('.nav-dropdown__sublist')).toBeNull();

  // El panel se encoge y el puntero quieto queda fuera: el menú sigue abierto.
  nav.dispatchEvent(new MouseEvent('mouseleave', { clientX: 10, clientY: 140 }));
  expect(component.openMenuId()).toBe(1);

  // Volver hacia el menú lo mantiene abierto; alejarse lo cierra.
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 120 }));
  expect(component.openMenuId()).toBe(1);
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 200 }));
  expect(component.openMenuId()).toBeNull();
});

it('closes the menu right away when the pointer really leaves it', async () => {
  const { fixture, hover, wait } = await openMegaMenu([
    { id: 1, slug: 'maquillaje', name: 'Maquillaje', children: [
      { id: 3, slug: 'ojos', name: 'Ojos', children: [] }
    ] }
  ]);
  hover('Ojos', 10, 40);
  wait();
  hover('Ojos', 12, 45);

  const nav = fixture.nativeElement.querySelector('.store-menu') as HTMLElement;
  nav.dispatchEvent(new MouseEvent('mouseleave', { clientX: 400, clientY: 45 }));
  expect(fixture.componentInstance.openMenuId()).toBeNull();
});

function createPortalLayout(
  canManageStore: boolean,
  menu: CategoryMenuItem[] = [{ id: 1, slug: 'root', name: 'Root', children: [] }],
  isAuthenticated = signal(canManageStore)
) {
  const getMenu = vi.fn(() => of(menu));
  TestBed.configureTestingModule({
    imports: [PublicLayoutComponent],
    providers: [provideRouter([]),
      { provide: AuthService, useValue: {
        canManageStore: signal(canManageStore), isAuthenticated, session: signal(null), ensureSession: () => of(null),
        priceAudienceKey: signal('anonymous')
      } },
      { provide: CategoryService, useValue: { getMenu } }
    ]
  });

  const fixture = TestBed.createComponent(PublicLayoutComponent);
  return Object.assign(fixture, { getMenu });
}

it('does not request the category menu for visitors, who never see it', async () => {
  const fixture = createPortalLayout(false);
  await fixture.whenStable();

  expect(fixture.getMenu).not.toHaveBeenCalled();
});

it('requests the menu once, when the session turns out to be authenticated', async () => {
  const isAuthenticated = signal(false);
  const fixture = createPortalLayout(false, undefined, isAuthenticated);
  await fixture.whenStable();
  expect(fixture.getMenu).not.toHaveBeenCalled();

  isAuthenticated.set(true);
  await fixture.whenStable();
  isAuthenticated.set(false);
  await fixture.whenStable();
  isAuthenticated.set(true);
  await fixture.whenStable();

  expect(fixture.getMenu).toHaveBeenCalledTimes(1);
  expect(fixture.componentInstance.menu().map(item => item.slug)).toEqual(['root']);
});

it('requests the menu when the ecommerce navigation is enabled', async () => {
  const fixture = createPortalLayout(false);
  fixture.componentRef.setInput('ecommerceNavigation', true);
  await fixture.whenStable();

  expect(fixture.getMenu).toHaveBeenCalledTimes(1);
});

it('hides the whole navigation menu from visitors while the portal is the only experience', async () => {
  const fixture = createPortalLayout(false);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.store-menu')).toBeNull();
  expect(fixture.nativeElement.textContent).not.toContain('Gestionar y administrar');
  expect(fixture.nativeElement.textContent).not.toContain('Favoritos');
});

it('shows the menu to an administrator with the wholesale page as one more option', async () => {
  const fixture = createPortalLayout(true);
  await fixture.whenStable();
  const nav = fixture.nativeElement.querySelector('.store-menu') as HTMLElement;
  const labels = Array.from(nav.querySelectorAll('.store-menu__link')).map(link => link.textContent?.replace(/\s+/g, ' ').trim());

  expect(labels).toEqual(['Root', 'Hazte mayorista', 'Gestionar y administrar']);
  expect(nav.querySelector('.store-menu__link--portal')?.getAttribute('href')).toBe('/mayoristas');
});

it('links the official social networks in the footer, opening in a new tab', async () => {
  const fixture = createPortalLayout(false);
  await fixture.whenStable();
  const links = Array.from(fixture.nativeElement.querySelectorAll('.social-links__item')) as HTMLAnchorElement[];

  expect(links.map(link => [link.getAttribute('title'), link.getAttribute('href'), link.getAttribute('target')])).toEqual([
    ['Instagram', 'https://www.instagram.com/magicbeautycosmeticscali', '_blank'],
    ['TikTok', 'https://www.tiktok.com/@magicbeautycosmeticscali', '_blank'],
    ['Facebook', 'https://www.facebook.com/share/1JfkRgWHcT/', '_blank']
  ]);
  expect(links.every(link => link.rel.includes('noopener'))).toBe(true);
});

it('shows the official email and the address linked to Google Maps', async () => {
  const fixture = createPortalLayout(false);
  await fixture.whenStable();
  const footer = fixture.nativeElement.querySelector('.store-footer') as HTMLElement;

  expect(footer.querySelector('a[href="mailto:magicbeauty0615@gmail.com"]')?.textContent?.trim()).toBe('magicbeauty0615@gmail.com');
  const address = footer.querySelector('.contact-address') as HTMLAnchorElement;
  expect(address.textContent?.trim()).toBe('Calle 13 # 44A - 26, Cali');
  expect(address.getAttribute('href')).toBe('https://maps.app.goo.gl/y5GSuFcaVCW9nVCi8');
  expect(address.getAttribute('target')).toBe('_blank');
  expect(fixture.nativeElement.textContent).not.toContain('cliente.magicbeauty');
});


it('offers header search to anonymous visitors in the public portal', async () => {
  const fixture = createPortalLayout(false);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.desktop-search')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('button[aria-label="Buscar"]')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('.mobile-search-panel')).not.toBeNull();
  fixture.destroy();
});

it('keeps header search available when ecommerce navigation is enabled', async () => {
  const fixture = createPortalLayout(false);
  fixture.componentRef.setInput('ecommerceNavigation', true);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.desktop-search')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('button[aria-label="Buscar"]')).not.toBeNull();
  fixture.destroy();
});

it('locks page scrolling while the mobile menu is open and restores it on close and destroy', async () => {
  const fixture = createPortalLayout(false);
  await fixture.whenStable();
  const initialBodyOverflow = document.body.style.overflow;
  const initialRootOverflow = document.documentElement.style.overflow;
  fixture.componentInstance.openMobileMenu();
  fixture.detectChanges();
  expect(document.body.style.overflow).toBe('hidden');
  expect(document.documentElement.style.overflow).toBe('hidden');
  fixture.componentInstance.closeMobileMenu();
  fixture.detectChanges();
  expect(document.body.style.overflow).toBe(initialBodyOverflow);
  expect(document.documentElement.style.overflow).toBe(initialRootOverflow);
  fixture.componentInstance.openMobileMenu();
  fixture.detectChanges();
  fixture.destroy();
  expect(document.body.style.overflow).toBe(initialBodyOverflow);
  expect(document.documentElement.style.overflow).toBe(initialRootOverflow);
});


it('offers a recursive expandable mobile category tree and links for every level', async () => {
  const fixture = createPortalLayout(true, [{ id: 10, name: 'Root', slug: 'root', children: [
    { id: 11, name: 'Child', slug: 'child', children: [
      { id: 12, name: 'Grandchild', slug: 'grandchild', children: [
        { id: 13, name: 'Leaf', slug: 'leaf', children: [] }
      ] }
    ] }
  ] }]);
  fixture.componentInstance.openMobileMenu();
  await fixture.whenStable();
  const panel = fixture.nativeElement.querySelector('.mobile-menu-panel') as HTMLElement;
  const branches = Array.from(panel.querySelectorAll('details.mobile-category')) as HTMLDetailsElement[];
  expect(branches).toHaveLength(3);
  for (const branch of branches) {
    expect(branch.open).toBe(false);
    (branch.querySelector('summary') as HTMLElement).click();
    expect(branch.open).toBe(true);
  }
  for (const slug of ['root', 'child', 'grandchild', 'leaf']) {
    expect(panel.querySelector('a[href="/categoria/' + slug + '"]')).not.toBeNull();
  }
  (branches[0].querySelector('summary') as HTMLElement).click();
  expect(branches[0].open).toBe(false);
  expect(fixture.componentInstance.isMobileMenuOpen()).toBe(true);
  fixture.destroy();
});
