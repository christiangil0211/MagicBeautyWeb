import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { CategoryService } from '../../../core/services/category.service';
import { OrderDraftService } from '../../../core/services/order-draft.service';
import { CatalogProductListItem } from '../../../shared/models/product.model';
import { HomeComponent } from './home.component';

const product = (id: number, overrides: Partial<CatalogProductListItem> = {}): CatalogProductListItem => ({
  id,
  reference: 'ABC' + String(id).padStart(3, '0'),
  name: 'Producto ' + id,
  brandName: '',
  hasVariants: false,
  availableQuantity: 3,
  mainImageUrl: '/media/p' + id + '.jpg',
  categoryIds: [id],
  prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 10000 }],
  ...overrides
});

async function render(options: { tiles?: unknown[]; products?: CatalogProductListItem[]; admin?: boolean } = {}) {
  TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { canManageStore: signal(options.admin ?? false) } },
      { provide: CategoryService, useValue: { getHomeTiles: () => of(options.tiles ?? []) } },
      { provide: CatalogService, useValue: { getProducts: () => of(options.products ?? []) } }
    ],
    deferBlockBehavior: DeferBlockBehavior.Manual
  });
  await TestBed.compileComponents();

  const fixture = TestBed.createComponent(HomeComponent);
  fixture.detectChanges();
  const [favorites] = await fixture.getDeferBlocks();
  await favorites.render(DeferBlockState.Complete);
  fixture.detectChanges();

  return { fixture, root: fixture.nativeElement as HTMLElement };
}

const text = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ');

it('links the featured categories to their public catalog page, at most eight', async () => {
  const tiles = Array.from({ length: 10 }, (_, i) => ({ id: i, name: 'Cat ' + i, slug: 'cat-' + i, imageUrl: '/c' + i + '.jpg' }));
  const { root } = await render({ tiles });
  const links = Array.from(root.querySelectorAll('.tiles a.tile'));

  expect(links.length).toBe(8);
  expect(links[0].getAttribute('href')).toBe('/catalogo/categoria/cat-0');
  expect(links[0].querySelector('img')?.getAttribute('loading')).toBe('lazy');
  expect(links[0].querySelector('img')?.getAttribute('alt')).toBe('Cat 0');
});

it('hides the category section from visitors when there are no featured categories', async () => {
  const { root } = await render({ tiles: [] });
  expect(root.querySelector('.shop-by-category')).toBeNull();
});

it('tells an administrator how to fill an empty category section', async () => {
  const { root } = await render({ tiles: [], admin: true });
  expect(root.querySelector('.admin-hint a')?.getAttribute('href')).toBe('/admin/categories');
});

it('never shows out-of-stock or photo-less products among the favorites, and allows products without a brand', async () => {
  const products = [
    product(1),
    product(2, { availableQuantity: 0 }),
    product(3, { mainImageUrl: null }),
    product(4, { prices: [{ priceTypeCode: 'WHOLESALE', priceTypeName: 'Por mayor', amount: 8000 }] }),
    product(5, { brandName: 'Milagros' })
  ];
  const { root } = await render({ products });
  const cards = Array.from(root.querySelectorAll('app-home-favorites app-product-card'), card => text(card));

  expect(cards.length).toBe(2);
  expect(cards.join(' ')).toContain('Producto 1');
  expect(cards.join(' ')).toContain('Producto 5');
});

it('adds a favorite to the real order, like the digital catalog', async () => {
  const { root, fixture } = await render({ products: [product(1)] });
  const draft = TestBed.inject(OrderDraftService);
  const before = draft.itemCount();

  (root.querySelector('app-home-favorites .product-card__action') as HTMLButtonElement).click();
  fixture.detectChanges();

  expect(draft.itemCount()).toBe(before + 1);
  expect(draft.lines().some(line => line.reference === 'ABC001')).toBe(true);
});

it('hides the favorites section when no product is ready for the home page', async () => {
  const { root } = await render({ products: [product(1, { availableQuantity: 0 })] });
  expect(root.querySelector('app-home-favorites')?.classList.contains('favorites--empty')).toBe(true);
});

it('shows the physical store with address, hours, WhatsApp, directions and a lazy map', async () => {
  const { root } = await render();
  const visit = root.querySelector('.visit') as HTMLElement;

  expect(visit.querySelector('h2')?.textContent).toBe('Visítanos en Cali');
  expect(text(visit)).toContain('Calle 13 # 44A - 26, Cali');
  expect(text(visit)).toContain('Lunes a sábado: 10:00 a. m. a 8:00 p. m.');
  expect(text(visit)).toContain('Domingo: cerrado');
  expect(text(visit)).toContain('+57 312 738 1185');
  const directions = Array.from(visit.querySelectorAll('a')).find(link => text(link).includes('Cómo llegar'));
  expect(directions?.getAttribute('href')).toBe('https://www.google.com/maps/dir/?api=1&destination=3.4137043,-76.533103');
  expect(directions?.getAttribute('target')).toBe('_blank');
  const map = visit.querySelector('iframe')!;
  expect(map.getAttribute('loading')).toBe('lazy');
  expect(map.getAttribute('src')).toContain('output=embed');
  expect(map.getAttribute('src')).not.toContain('key=');
  expect(map.getAttribute('title')).toContain('Mapa');
});

it('invites businesses to the wholesale page and keeps the benefits strip', async () => {
  const { root } = await render();
  const strip = root.querySelector('.wholesale-strip') as HTMLElement;

  expect(text(strip)).toContain('¿Tienes un negocio?');
  expect(text(strip)).toContain('$100.000');
  expect(strip.querySelector('a')?.getAttribute('href')).toBe('/mayoristas');
  expect(root.querySelectorAll('.benefits .benefit').length).toBe(4);
});

it('has no h1 of its own: the fixed page title comes from the portal', async () => {
  const { root } = await render();
  expect(root.querySelector('h1')).toBeNull();
});
