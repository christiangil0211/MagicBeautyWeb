import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CategoryService } from '../../../core/services/category.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { CatalogComponent } from './catalog.component';

it('loads products for category 6 and updates when the category changes', async () => {
  const requested: (number | null | undefined)[] = [];
  TestBed.configureTestingModule({
    imports: [CatalogComponent],
    providers: [provideRouter([]),
      { provide: AuthService, useValue: { canManageStore: signal(false) } },
      { provide: CategoryService, useValue: { getMenu: () => of([
        { id: 6, slug: 'labiales', name: 'Labiales', children: [] },
        { id: 7, slug: 'ojos', name: 'Ojos', children: [] }
      ]) } },
      { provide: CatalogService, useValue: { getProducts: (filters: { categoryId?: number | null }) => {
        requested.push(filters.categoryId);
        return of([{ id: 399, reference: 'REF399', name: 'Producto 399', brandName: 'Marca', hasVariants: false, availableQuantity: 1, prices: [] }]);
      } } }
    ]
  });
  const fixture = TestBed.createComponent(CatalogComponent);
  fixture.componentRef.setInput('slug', 'labiales');
  await fixture.whenStable();
  expect(requested).toEqual([6]);
  expect(fixture.nativeElement.textContent).toContain('Producto 399');
  fixture.componentRef.setInput('slug', 'ojos');
  await fixture.whenStable();
  expect(requested).toEqual([6, 7]);
});
