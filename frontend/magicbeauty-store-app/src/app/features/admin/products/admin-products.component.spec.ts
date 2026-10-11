import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { BrandService } from '../../../core/services/brand.service';
import { ProductService } from '../../../core/services/product.service';
import { ProductListItem } from '../../../shared/models/product.model';
import { AdminProductsComponent } from './admin-products.component';

it('searches while typing and ignores an obsolete response', async () => {
  const requests: { search: string | null | undefined; response: Subject<ProductListItem[]> }[] = [];
  TestBed.configureTestingModule({
    imports: [AdminProductsComponent],
    providers: [provideRouter([]),
      { provide: BrandService, useValue: { getAll: () => of([]) } },
      { provide: ProductService, useValue: { getAll: (filters: { search?: string | null }) => {
        const response = new Subject<ProductListItem[]>();
        requests.push({ search: filters.search, response });
        return response;
      } } }
    ]
  });
  const fixture = TestBed.createComponent(AdminProductsComponent);
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  input.value = ' labial ';
  input.dispatchEvent(new Event('input'));
  await new Promise(resolve => setTimeout(resolve, 400));
  expect(requests.length).toBe(2);
  expect(requests[1].search).toBe('labial');
  requests[1].response.next([{ id: 2, name: 'Labial', categories: [], reference: 'REF', brandId: 1, brandName: 'Marca', hasVariants: false, isActive: true, totalQuantity: 0 }]);
  requests[0].response.next([{ id: 1, name: 'Anterior', categories: [], reference: 'REF', brandId: 1, brandName: 'Marca', hasVariants: false, isActive: true, totalQuantity: 0 }]);
  expect(fixture.componentInstance.products().map(product => product.id)).toEqual([2]);
  input.value = '';
  input.dispatchEvent(new Event('input'));
  await new Promise(resolve => setTimeout(resolve, 400));
  expect(requests[2].search).toBeNull();
  fixture.destroy();
  expect(requests[2].response.observed).toBe(false);
});

function setupFilters() {
  const calls: Record<string, unknown>[] = [];
  const item = (id: number, isActive: boolean, categories: string[]): ProductListItem => ({
    id, name: 'Producto ' + id, categories, reference: 'REF' + id, brandId: 1, brandName: 'Marca', hasVariants: false, isActive, totalQuantity: 2
  });
  const all = [item(1, true, ['Labios']), item(2, true, []), item(3, false, ['Labios']), item(4, false, [])];
  TestBed.configureTestingModule({
    imports: [AdminProductsComponent],
    providers: [provideRouter([]),
      { provide: BrandService, useValue: { getAll: () => of([]) } },
      // Imita al API: el filtrado ocurre en el servidor.
      { provide: ProductService, useValue: { getAll: (filters: { isActive?: boolean | null; hasCategories?: boolean | null }) => {
        calls.push({ ...filters });
        return of(all.filter(product =>
          (filters.isActive == null || product.isActive === filters.isActive) &&
          (filters.hasCategories == null || product.categories.length > 0 === filters.hasCategories)));
      } } }
    ]
  });
  const fixture = TestBed.createComponent(AdminProductsComponent);
  fixture.detectChanges();
  return { calls, fixture, component: fixture.componentInstance };
}
it('lists active and inactive products by default, without a category restriction', () => {
  const { calls, component } = setupFilters();
  expect(calls[0]).toEqual({ search: null, brandId: null, isActive: null, hasCategories: null });
  expect(component.products().map(product => product.id)).toEqual([1, 2, 3, 4]);
});
it('asks the API for products without category and combines it with the status filter', () => {
  const { calls, component } = setupFilters();
  component.categoryFilter.set(false);
  component.load();
  expect(calls.at(-1)).toMatchObject({ hasCategories: false, isActive: null });
  expect(component.products().map(product => product.id)).toEqual([2, 4]);

  component.statusFilter.set(false);
  component.load();
  expect(calls.at(-1)).toMatchObject({ hasCategories: false, isActive: false });
  expect(component.products().map(product => product.id)).toEqual([4]);

  component.categoryFilter.set(true);
  component.statusFilter.set(true);
  component.load();
  expect(calls.at(-1)).toMatchObject({ hasCategories: true, isActive: true });
  expect(component.products().map(product => product.id)).toEqual([1]);
});
it('shows totals for the filtered result and clears the category filter with the others', async () => {
  const { calls, fixture, component } = setupFilters();
  component.categoryFilter.set(false);
  component.load();
  fixture.detectChanges();
  await fixture.whenStable();
  const stats = () => Array.from(fixture.nativeElement.querySelectorAll('.mb-stat strong') as NodeListOf<HTMLElement>).map(node => node.textContent?.trim());
  expect(stats()).toEqual(['2', '1', '4']);

  component.clearFilters();
  fixture.detectChanges();
  await fixture.whenStable();
  expect(component.categoryFilter()).toBeNull();
  expect(calls.at(-1)).toEqual({ search: null, brandId: null, isActive: null, hasCategories: null });
  expect(stats()).toEqual(['4', '2', '8']);
});
it('renders the category filter next to the status filter', () => {
  const { fixture } = setupFilters();
  expect(fixture.nativeElement.querySelectorAll('.filters p-select').length).toBe(3);
});
