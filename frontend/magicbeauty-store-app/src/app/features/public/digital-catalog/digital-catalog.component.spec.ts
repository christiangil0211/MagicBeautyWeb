import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { CategoryService } from '../../../core/services/category.service';
import { DigitalCatalogComponent } from './digital-catalog.component';

const product = (id: number, brandName: string, categoryIds: number[], retail: number) => ({
  id, reference: 'REF' + id, name: 'Producto ' + id, brandName, hasVariants: false, availableQuantity: 1, categoryIds,
  prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: retail }]
});

async function setup(
  inputs: Record<string, string> = {},
  productsForAudience?: (audience: string) => Observable<ReturnType<typeof product>[]>
) {
  const requests: unknown[] = [];
  const priceAudienceKey = signal(productsForAudience ? 'distributor-version-1' : 'anonymous');

  TestBed.configureTestingModule({
    imports: [DigitalCatalogComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { canManageStore: signal(false), priceAudienceKey } },
      { provide: CategoryService, useValue: { getCatalogTree: () => of([
        { id: 1, slug: 'maquillaje', name: 'Maquillaje', children: [{ id: 6, slug: 'labiales', name: 'Labiales', children: [] }] },
        { id: 2, slug: 'skincare', name: 'Skincare', children: [] }
      ]) } },
      { provide: CatalogService, useValue: { getProducts: (filters: unknown) => {
        requests.push(filters);
        return productsForAudience?.(priceAudienceKey()) ?? of([
          product(1, 'Milagros', [6], 25000),
          product(2, 'Trendy', [2], 9000),
          product(3, 'Milagros', [1], 40000)
        ]);
      } } }
    ]
  });

  const fixture = TestBed.createComponent(DigitalCatalogComponent);
  Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();

  const names = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.product-card__name')).map(name => (name as HTMLElement).textContent?.trim());

  return { fixture, requests, names, priceAudienceKey };
}

it('shows the filters on the left with category and brand counts', async () => {
  const { fixture } = await setup();
  const labels = Array.from(fixture.nativeElement.querySelectorAll('.filters .check')).map(label =>
    (label as HTMLElement).textContent?.replace(/\s+/g, ' ').trim()
  );

  expect(labels).toEqual(['Maquillaje(2)', 'Skincare(1)', 'Milagros(2)', 'Trendy(1)']);
});

it('filters by a parent category including its subcategories', async () => {
  const { fixture, names } = await setup();

  fixture.componentInstance.toggleCategory(1);
  await fixture.whenStable();

  expect(names()).toEqual(['Producto 1', 'Producto 3']);
});

it('preselects the category and brand that arrive in the URL', async () => {
  const { names, requests } = await setup({ categoria: 'labiales', marca: 'Milagros' });

  expect(names()).toEqual(['Producto 1']);
  // Todo se filtra sobre un solo listado: no se pide al API por categoría.
  expect(requests).toEqual([{ search: null, categoryId: null }]);
});

it('shows the result count and sorts by visible price', async () => {
  const { fixture, names } = await setup();

  expect(fixture.nativeElement.querySelector('.toolbar__count').textContent).toContain('3 productos');

  fixture.componentInstance.setSort('price-desc');
  await fixture.whenStable();

  expect(names()).toEqual(['Producto 3', 'Producto 1', 'Producto 2']);
});

it('clears private prices and reloads when the audience changes', async () => {
  const privatePrices = new Subject<ReturnType<typeof product>[]>();
  const publicPrices = new Subject<ReturnType<typeof product>[]>();
  const { fixture, requests, priceAudienceKey, names } = await setup({}, audience =>
    audience === 'distributor-version-1' ? privatePrices : publicPrices
  );
  const privateProduct = {
    ...product(1, 'Milagros', [1], 24000),
    prices: [{ priceTypeCode: 'DISTRIBUTOR', priceTypeName: 'Distribuidor', amount: 24000 }]
  };
  privatePrices.next([privateProduct]);
  await fixture.whenStable();
  expect(names()).toEqual(['Producto 1']);
  expect(fixture.nativeElement.textContent).toContain('Distribuidor');

  priceAudienceKey.set('anonymous');
  privatePrices.next([{ ...privateProduct, name: 'Resultado anterior' }]);
  expect(fixture.componentInstance.items()).toEqual([]);
  await fixture.whenStable();
  expect(requests).toHaveLength(2);
  expect(names()).toEqual([]);
  expect(fixture.nativeElement.textContent).not.toContain('Distribuidor');

  publicPrices.next([product(2, 'Milagros', [1], 10000)]);
  await fixture.whenStable();
  expect(names()).toEqual(['Producto 2']);
  expect(fixture.nativeElement.textContent).toContain('Detal');
});

it('searches categories by name and opens the branch that matches', async () => {
  const { fixture } = await setup();
  const labels = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.filters .tree-row .check__label')).map(label =>
      (label as HTMLElement).textContent?.trim()
    );

  expect(labels()).toEqual(['Maquillaje', 'Skincare']);

  fixture.componentInstance.categoryQuery.set('labi');
  await fixture.whenStable();

  expect(labels()).toEqual(['Maquillaje', 'Labiales']);

  fixture.componentInstance.categoryQuery.set('nada');
  await fixture.whenStable();

  expect(fixture.nativeElement.textContent).toContain('Ninguna categoría coincide.');
});

it('expands and collapses a category with its arrow', async () => {
  const { fixture } = await setup();
  const toggle = fixture.nativeElement.querySelector('.tree-row__toggle') as HTMLButtonElement;

  toggle.click();
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Labiales');

  toggle.click();
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent).not.toContain('Labiales');
});


it('locks background scrolling while filters are open and restores previous styles', async () => {
  const { fixture } = await setup();
  const bodyBefore = document.body.style.overflow;
  const rootBefore = document.documentElement.style.overflow;
  fixture.componentInstance.filtersOpen.set(true);
  fixture.detectChanges();
  expect(document.body.style.overflow).toBe('hidden');
  expect(document.documentElement.style.overflow).toBe('hidden');
  fixture.componentInstance.filtersOpen.set(false);
  fixture.detectChanges();
  expect(document.body.style.overflow).toBe(bodyBefore);
  expect(document.documentElement.style.overflow).toBe(rootBefore);
  fixture.componentInstance.filtersOpen.set(true);
  fixture.detectChanges();
  fixture.destroy();
  expect(document.body.style.overflow).toBe(bodyBefore);
  expect(document.documentElement.style.overflow).toBe(rootBefore);
});
