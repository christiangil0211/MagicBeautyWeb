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
