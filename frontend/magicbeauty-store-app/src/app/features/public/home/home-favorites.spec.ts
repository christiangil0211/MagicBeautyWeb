import { CatalogProductListItem } from '../../../shared/models/product.model';
import { isHomeReady, pickHomeFavorites } from './home-favorites';

const product = (id: number, categoryIds: number[], overrides: Partial<CatalogProductListItem> = {}): CatalogProductListItem => ({
  id,
  reference: 'REF' + id,
  name: 'P' + id,
  brandName: '',
  hasVariants: false,
  availableQuantity: 2,
  mainImageUrl: '/p.jpg',
  categoryIds,
  prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 5000 }],
  ...overrides
});

describe('isHomeReady', () => {
  it('requires a photo, a retail price and stock, but not a brand', () => {
    expect(isHomeReady(product(1, [1]))).toBe(true);
    expect(isHomeReady(product(1, [1], { mainImageUrl: null }))).toBe(false);
    expect(isHomeReady(product(1, [1], { availableQuantity: 0 }))).toBe(false);
    expect(isHomeReady(product(1, [1], { prices: [] }))).toBe(false);
    expect(isHomeReady(product(1, [1], { prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 0 }] }))).toBe(false);
  });
});

describe('pickHomeFavorites', () => {
  const catalog = Array.from({ length: 60 }, (_, i) => product(i + 1, [Math.floor(i / 6) + 1]));

  it('returns at most twelve products and at most two per category', () => {
    const picked = pickHomeFavorites(catalog, '2026-11-25');
    const perCategory = new Map<number, number>();
    picked.forEach(item => perCategory.set(item.categoryIds[0], (perCategory.get(item.categoryIds[0]) ?? 0) + 1));

    expect(picked.length).toBe(12);
    expect(Math.max(...perCategory.values())).toBeLessThanOrEqual(2);
  });

  it('is stable for a day and changes on another day', () => {
    const ids = (seed: string) => pickHomeFavorites(catalog, seed).map(item => item.id);

    expect(ids('2026-11-25')).toEqual(ids('2026-11-25'));
    expect(ids('2026-11-26')).not.toEqual(ids('2026-11-25'));
  });

  it('skips products that are not ready and counts products without a category as one group', () => {
    const picked = pickHomeFavorites(
      [product(1, []), product(2, []), product(3, []), product(4, [9], { availableQuantity: 0 })],
      'x'
    );

    expect(picked).toHaveLength(2);
    expect(picked.some(item => item.id === 4)).toBe(false);
  });
});
