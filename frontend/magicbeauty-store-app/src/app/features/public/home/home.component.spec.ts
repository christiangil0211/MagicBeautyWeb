import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { CatalogService } from '../../../core/services/catalog.service';
import { CategoryService } from '../../../core/services/category.service';
import { AuthService } from '../../../core/services/auth.service';
import { PORTAL_BANNERS } from '../portal/portal-navigation';

it('shows the campaign carousel of its route instead of a hero of its own, followed by the store sections', async () => {
  const products = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, reference: 'ABC00' + i, name: 'Product ' + i, brandName: 'Brand', hasVariants: false, availableQuantity: 1, prices: [], mainImageUrl: '/media/product-' + i + '.png' }));
  TestBed.configureTestingModule({ providers: [
    provideRouter([{ path: 'mi-tienda', component: HomeComponent, data: { portalBanner: PORTAL_BANNERS.benefits } }]),
    { provide: AuthService, useValue: { canManageStore: signal(false) } },
    { provide: CategoryService, useValue: { getHomeTiles: () => of([]) } },
    { provide: CatalogService, useValue: { getProducts: () => of(products) } },
  ] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/mi-tienda');
  const root = harness.fixture.nativeElement as HTMLElement;

  expect(root.querySelector('.home-slide__link img')?.getAttribute('src')).toBe('/images/campaigns/banner-calendario-magic-beauty-2026.jpg');
  expect(root.querySelector('.hero')).toBeNull();
  expect(root.querySelector('.shop-by-category')).not.toBeNull();
  expect(root.querySelectorAll('.favorites app-product-card').length).toBe(5);
});
