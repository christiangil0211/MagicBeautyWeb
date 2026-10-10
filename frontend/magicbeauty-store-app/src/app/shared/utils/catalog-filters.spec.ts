import { CatalogProductListItem } from '../models/product.model';
import { collectSubtrees, filterCatalog, sortCatalog } from './catalog-filters';

const item = (id: number, brandName: string, categoryIds: number[], retail: number | null): CatalogProductListItem => ({
  id,
  reference: 'REF' + id,
  name: 'Producto ' + String.fromCharCode(64 + id),
  brandName,
  hasVariants: false,
  availableQuantity: 1,
  categoryIds,
  // El mayorista va primero a propósito: el filtro usa el código RETAIL, no la posición.
  prices: [
    { priceTypeCode: 'WHOLESALE', priceTypeName: 'Por mayor', amount: 1 },
    ...(retail === null ? [] : [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: retail }])
  ]
});

const items = [
  item(1, 'Milagros', [6], 25000),
  item(2, 'Trendy', [7], 9000),
  item(3, 'Milagros', [2], 40000),
  item(4, 'Dapop', [6], null)
];

const subtrees = collectSubtrees([
  { id: 1, name: 'Maquillaje', slug: 'maquillaje', children: [
    { id: 6, name: 'Labiales', slug: 'labiales', children: [] },
    { id: 7, name: 'Ojos', slug: 'ojos', children: [] }
  ] },
  { id: 2, name: 'Skincare', slug: 'skincare', children: [] }
]);

describe('catalog filters', () => {
  it('includes subcategories when a parent category is selected', () => {
    expect([...subtrees.get(1)!]).toEqual([1, 6, 7]);
    expect(filterCatalog(items, { categoryIds: subtrees.get(1)!, brandNames: null, priceRange: null }).map(i => i.id)).toEqual([1, 2, 4]);
  });

  it('combines groups with AND and options of a group with OR', () => {
    const result = filterCatalog(items, {
      categoryIds: new Set([...subtrees.get(1)!, ...subtrees.get(2)!]),
      brandNames: new Set(['Milagros']),
      priceRange: null
    });

    expect(result.map(i => i.id)).toEqual([1, 3]);
  });

  it('filters by the RETAIL price and leaves out products without it', () => {
    const result = filterCatalog(items, { categoryIds: null, brandNames: null, priceRange: { min: 10000, max: 30000 } });

    expect(result.map(i => i.id)).toEqual([1]);
  });

  it('sorts by retail price with products without price at the end', () => {
    expect(sortCatalog(items, 'price-asc').map(i => i.id)).toEqual([2, 1, 3, 4]);
    expect(sortCatalog(items, 'price-desc').map(i => i.id)).toEqual([3, 1, 2, 4]);
    expect(sortCatalog(items, 'name').map(i => i.id)).toEqual([1, 2, 3, 4]);
  });
});
