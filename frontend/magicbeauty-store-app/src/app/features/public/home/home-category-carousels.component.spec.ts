import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Observable, of, throwError } from 'rxjs';

import { CatalogService } from '../../../core/services/catalog.service';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryCarousel } from '../../../shared/models/category.model';
import { CatalogProductListItem } from '../../../shared/models/product.model';
import { pickCategoryProducts } from './home-category-carousel.component';
import { HomeCategoryCarouselsComponent } from './home-category-carousels.component';

const product = (id: number, categoryId: number): CatalogProductListItem =>
  ({
    id,
    reference: 'REF' + id,
    name: 'Producto ' + id,
    brandName: 'Marca',
    mainImageUrl: 'https://blob/p' + id + '.png',
    availableQuantity: 5,
    categoryIds: [categoryId],
    prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 10000 }]
  }) as unknown as CatalogProductListItem;

async function render(
  carousels: CategoryCarousel[] | Error,
  productsFor: (categoryId: number) => Observable<CatalogProductListItem[]> = () => of([])
) {
  const getProducts = vi.fn(({ categoryId }: { categoryId: number }) => productsFor(categoryId));

  TestBed.configureTestingModule({
    imports: [HomeCategoryCarouselsComponent],
    providers: [
      provideRouter([]),
      MessageService,
      {
        provide: CategoryService,
        useValue: { getHomeCarousels: () => (carousels instanceof Error ? throwError(() => carousels) : of(carousels)) }
      },
      { provide: CatalogService, useValue: { getProducts } }
    ],
    deferBlockBehavior: DeferBlockBehavior.Manual
  });
  await TestBed.compileComponents();

  const fixture = TestBed.createComponent(HomeCategoryCarouselsComponent);
  fixture.detectChanges();
  for (const block of await fixture.getDeferBlocks()) await block.render(DeferBlockState.Complete);
  fixture.detectChanges();

  return { root: fixture.nativeElement as HTMLElement, getProducts };
}

it('renders one carousel per category, in order, each with its own products and link', async () => {
  const { root, getProducts } = await render(
    [
      { id: 1, name: 'Cuidado capilar', slug: 'cuidado-capilar' },
      { id: 15, name: 'Shampoo', slug: 'shampoo' }
    ],
    categoryId => of([product(categoryId * 10, categoryId), product(categoryId * 10 + 1, categoryId)])
  );

  expect(getProducts.mock.calls.map(call => call[0])).toEqual([{ categoryId: 1, homeRanking: true }, { categoryId: 15, homeRanking: true }]);
  expect(Array.from(root.querySelectorAll('h2'), title => title.textContent?.trim())).toEqual(['Cuidado capilar', 'Shampoo']);
  expect(Array.from(root.querySelectorAll('.carousel__all'), link => link.getAttribute('href'))).toEqual([
    '/catalogo/categoria/cuidado-capilar',
    '/catalogo/categoria/shampoo'
  ]);
});

it('hides a carousel without products ready for the home and keeps the others', async () => {
  const { root } = await render(
    [
      { id: 1, name: 'Vacía', slug: 'vacia' },
      { id: 2, name: 'Con productos', slug: 'con-productos' }
    ],
    categoryId => of(categoryId === 1 ? [] : [product(5, 2)])
  );

  expect(Array.from(root.querySelectorAll('h2'), title => title.textContent?.trim())).toEqual(['Con productos']);
});

it('shows the fallback for a carousel whose products fail to load', async () => {
  const { root } = await render([{ id: 1, name: 'Shampoo', slug: 'shampoo' }], () => throwError(() => new Error('503')));

  expect(root.querySelector('app-home-fallback')).not.toBeNull();
});

it('renders nothing when there are no carousels or the API fails', async () => {
  expect((await render([])).root.querySelector('app-home-category-carousel')).toBeNull();
  TestBed.resetTestingModule();
  expect((await render(new Error('503'))).root.querySelector('app-home-category-carousel')).toBeNull();
});

describe('pickCategoryProducts', () => {
  it('fills the carousel with a single subcategory, and splits it when there are several', () => {
    const single = Array.from({ length: 30 }, (_, i) => product(i + 1, 15));
    const mixed = [...single, ...Array.from({ length: 30 }, (_, i) => product(100 + i, 17))];

    expect(pickCategoryProducts(single, 'x')).toHaveLength(16);

    const picked = pickCategoryProducts(mixed, 'x');
    expect(picked).toHaveLength(16);
    expect(picked.filter(item => item.categoryIds[0] === 15)).toHaveLength(8);
  });
});

it('keeps ranked products in server order ahead of the existing daily fill', () => {
  const ranked = [{ ...product(9, 1), isBestSeller: true }, { ...product(2, 1), isBestSeller: true }];
  const fill = [product(5, 1), product(3, 1), product(7, 1)];

  expect(pickCategoryProducts([...ranked, ...fill], 'x').map(item => item.id))
    .toEqual([9, 2, ...pickCategoryProducts(fill, 'x').map(item => item.id)]);
});
