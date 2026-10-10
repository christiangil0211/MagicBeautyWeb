import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CategoryService } from '../../core/services/category.service';
import { PublicLayoutComponent } from './public-layout.component';

it('opens every nested level on hover and keeps ancestors open', async () => {
  TestBed.configureTestingModule({
    imports: [PublicLayoutComponent],
    providers: [provideRouter([]),
      { provide: AuthService, useValue: {
        canManageStore: signal(false), isAuthenticated: signal(false), session: signal(null), ensureSession: () => of(null)
      } },
      { provide: CategoryService, useValue: { getMenu: () => of([
        { id: 1, slug: 'root', name: 'Root', children: [
          { id: 2, slug: 'child', name: 'Child', children: [
            { id: 3, slug: 'grandchild', name: 'Grandchild', children: [
              { id: 4, slug: 'leaf', name: 'Leaf', children: [] }
            ] }
          ] }
        ] }
      ]) } }
    ]
  });
  const fixture = TestBed.createComponent(PublicLayoutComponent);
  // El mega menú es navegación del e-commerce: en el portal está apagado.
  fixture.componentRef.setInput('ecommerceNavigation', true);
  await fixture.whenStable();
  fixture.nativeElement.querySelector('.store-menu__item').dispatchEvent(new Event('mouseenter'));
  fixture.detectChanges();
  const child = fixture.nativeElement.querySelector('.nav-dropdown__branch') as HTMLElement;
  child.dispatchEvent(new Event('mouseenter'));
  fixture.detectChanges();
  const grandchild = child.querySelector('.nav-dropdown__branch') as HTMLElement;
  expect(grandchild).not.toBeNull();
  grandchild.dispatchEvent(new Event('mouseenter'));
  fixture.detectChanges();
  expect(grandchild.textContent).toContain('Leaf');
  expect(fixture.componentInstance.isChildExpanded(2)).toBe(true);
  expect(fixture.componentInstance.isChildExpanded(3)).toBe(true);
  child.dispatchEvent(new Event('mouseleave'));
  fixture.detectChanges();
  expect(child.querySelector('.nav-dropdown__sublist')).toBeNull();
});

function createPortalLayout(canManageStore: boolean) {
  TestBed.configureTestingModule({
    imports: [PublicLayoutComponent],
    providers: [provideRouter([]),
      { provide: AuthService, useValue: {
        canManageStore: signal(canManageStore), isAuthenticated: signal(canManageStore), session: signal(null), ensureSession: () => of(null)
      } },
      { provide: CategoryService, useValue: { getMenu: () => of([{ id: 1, slug: 'root', name: 'Root', children: [] }]) } }
    ]
  });

  return TestBed.createComponent(PublicLayoutComponent);
}

it('hides the whole navigation menu from visitors while the portal is the only experience', async () => {
  const fixture = createPortalLayout(false);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.store-menu')).toBeNull();
  expect(fixture.nativeElement.textContent).not.toContain('Gestionar y administrar');
  expect(fixture.nativeElement.textContent).not.toContain('Favoritos');
});

it('shows the menu to an administrator with the portal as one more option', async () => {
  const fixture = createPortalLayout(true);
  await fixture.whenStable();
  const nav = fixture.nativeElement.querySelector('.store-menu') as HTMLElement;
  const labels = Array.from(nav.querySelectorAll('.store-menu__link')).map(link => link.textContent?.replace(/\s+/g, ' ').trim());

  expect(labels).toEqual(['Root', 'Hazte mayorista', 'Gestionar y administrar']);
  expect(nav.querySelector('.store-menu__link--portal')?.getAttribute('href')).toBe('/');
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
