import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProductService } from './product.service';

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { service: TestBed.inject(ProductService), http: TestBed.inject(HttpTestingController) };
}
it('sends hasCategories=false together with the other filters', () => {
  const { service, http } = setup();
  service.getAll({ hasCategories: false, isActive: true, brandId: 3, search: 'labial' }).subscribe();
  const request = http.expectOne(candidate => candidate.url.endsWith('/products'));
  expect(request.request.params.get('hasCategories')).toBe('false');
  expect(request.request.params.get('isActive')).toBe('true');
  expect(request.request.params.get('brandId')).toBe('3');
  expect(request.request.params.get('search')).toBe('labial');
  request.flush([]);
  http.verify();
});
it('omits hasCategories when the filter is not set', () => {
  const { service, http } = setup();
  service.getAll({ hasCategories: null }).subscribe();
  const request = http.expectOne(candidate => candidate.url.endsWith('/products'));
  expect(request.request.params.has('hasCategories')).toBe(false);
  request.flush([]);
  http.verify();
});
it('posts the bulk category assignment', () => {
  const { service, http } = setup();
  let updated = 0;
  service.assignCategory(21, [301, 303]).subscribe(result => (updated = result.updatedCount));
  const request = http.expectOne(candidate => candidate.url.endsWith('/products/categories/assign'));
  expect(request.request.method).toBe('POST');
  expect(request.request.body).toEqual({ categoryId: 21, productIds: [301, 303] });
  request.flush({ updatedCount: 2 });
  expect(updated).toBe(2);
  http.verify();
});
