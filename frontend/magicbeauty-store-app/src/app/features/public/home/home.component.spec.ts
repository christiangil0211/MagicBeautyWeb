import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { CatalogService } from '../../../core/services/catalog.service';
import { CategoryService } from '../../../core/services/category.service';
import { AuthService } from '../../../core/services/auth.service';

it('renders real catalog images as accessible product links while keeping campaign text in HTML', async () => {
  const products = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, reference: 'ABC00' + i, name: 'Product ' + i, brandName: 'Brand', hasVariants: false, availableQuantity: 1, prices: [], mainImageUrl: i === 0 ? null : '/media/product-' + i + '.png' }));
  TestBed.configureTestingModule({ imports: [HomeComponent], providers: [provideRouter([]),
    { provide: AuthService, useValue: { canManageStore: signal(false) } },
    { provide: CategoryService, useValue: { getHomeTiles: () => of([]) } },
    { provide: CatalogService, useValue: { getProducts: () => of(products) } },
  ] });
  const fixture = TestBed.createComponent(HomeComponent);
  await fixture.whenStable();
  const images = fixture.nativeElement.querySelectorAll('.hero__product img') as NodeListOf<HTMLImageElement>;
  expect(images.length).toBe(3);
  expect(images[0].getAttribute('src')).toBe('/media/product-1.png');
  expect(images[0].alt).toBe('Product 1');
  expect(images[0].closest('a')?.getAttribute('href')).toBe('/productos/ABC001');
  expect(fixture.nativeElement.querySelector('h1').textContent).toBe('ESENCIA');
  expect(fixture.nativeElement.querySelector('.hero__actions a')).not.toBeNull();
});
