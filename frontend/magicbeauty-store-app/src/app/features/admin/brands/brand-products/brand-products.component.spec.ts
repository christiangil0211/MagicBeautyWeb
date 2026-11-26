import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { BrandService } from '../../../../core/services/brand.service';
import { Brand, BrandProductItem, BrandProductsPage } from '../../../../shared/models/brand.model';
import { BrandProductsComponent } from './brand-products.component';

const BRAND: Brand = {
  id: 1, name: 'Purpure', slug: 'purpure', isFeatured: false, sortOrder: 0, isActive: true, productCount: 1, createdAt: '', updatedAt: ''
};

const product = (id: number, brandId: number | null, brandName: string | null): BrandProductItem => ({
  id, reference: 'REF' + id, name: 'Producto ' + id, isActive: true, brandId, brandName
});

@Component({
  imports: [BrandProductsComponent],
  template: '<app-brand-products [brand]="brand()" (changed)="changes = changes + 1" />'
})
class HostComponent {
  readonly brand = signal<Brand | null>(BRAND);
  changes = 0;
}

function setup(page: BrandProductsPage) {
  const brandService = {
    getProducts: vi.fn().mockReturnValue(of(page)),
    assignProducts: vi.fn(),
    removeProducts: vi.fn().mockReturnValue(of({ updatedCount: 1 }))
  };
  const confirmations: Confirmation[] = [];

  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      MessageService,
      { provide: ConfirmationService, useValue: { confirm: (confirmation: Confirmation) => confirmations.push(confirmation) } },
      { provide: BrandService, useValue: brandService }
    ]
  });

  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const component = fixture.debugElement.children[0].componentInstance as BrandProductsComponent;

  return { fixture, component, brandService, confirmations };
}

const page = (items: BrandProductItem[]): BrandProductsPage => ({ items, total: items.length, page: 1, pageSize: 25 });

it('starts with the products without brand, first page, for the selected brand', () => {
  const { brandService, fixture } = setup(page([product(2, null, null)]));

  expect(brandService.getProducts).toHaveBeenCalledWith(1, 'without-brand', '', 1, 25);
  expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sin marca');
});

it('assigns products without brand straight away and reports the change', () => {
  const { component, brandService, fixture } = setup(page([product(2, null, null)]));
  brandService.assignProducts.mockReturnValue(of({ updatedCount: 1 }));

  component.selected.set(component.products());
  component.assignSelected();

  expect(brandService.assignProducts).toHaveBeenCalledWith(1, [2], false);
  expect(fixture.componentInstance.changes).toBe(1);
});

it('asks before moving a product from another brand and only then moves it', () => {
  const { component, brandService, confirmations } = setup(page([product(3, 2, 'Dear Body')]));
  const conflict = { productId: 3, reference: 'REF3', name: 'Producto 3', currentBrandId: 2, currentBrandName: 'Dear Body' };
  brandService.assignProducts
    .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { error: 'Confirma', conflicts: [conflict] } })))
    .mockReturnValueOnce(of({ updatedCount: 1 }));

  component.selected.set(component.products());
  component.assignSelected();

  expect(brandService.assignProducts).toHaveBeenCalledTimes(1);
  expect(confirmations).toHaveLength(1);
  expect(confirmations[0].message).toContain('es de Dear Body, se moverá a Purpure');

  confirmations[0].accept!();
  expect(brandService.assignProducts).toHaveBeenLastCalledWith(1, [3], true);
});

it('removes products of this brand after confirming, leaving them without brand', () => {
  const { component, brandService, confirmations } = setup(page([product(4, 1, 'Purpure'), product(5, null, null)]));

  component.selected.set(component.products());
  expect(component.toRemove().map(item => item.id)).toEqual([4]);
  expect(component.toAssign().map(item => item.id)).toEqual([5]);

  component.removeSelected();
  expect(confirmations[0].message).toContain('sin marca');
  confirmations[0].accept!();

  expect(brandService.removeProducts).toHaveBeenCalledWith([4]);
});

it('marks the products that already belong to the brand', () => {
  const { fixture } = setup(page([product(4, 1, 'Purpure')]));

  expect((fixture.nativeElement as HTMLElement).querySelector('.row--in-brand .chip--current')?.textContent).toContain('Esta marca');
});
