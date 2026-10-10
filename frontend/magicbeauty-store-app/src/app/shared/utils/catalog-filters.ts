import { CategoryMenuItem } from '../models/category.model';
import { PRICE_TYPE_CODES } from '../models/price-type.model';
import { CatalogProductListItem } from '../models/product.model';

export type ProductSort = 'name' | 'price-asc' | 'price-desc';

export interface PriceRange {
  min: number;
  max: number;
}

/**
 * Filtros del catálogo digital. Se aplican en el navegador sobre el listado que
 * ya entregó el API (que solo trae productos activos y precios autorizados):
 * dentro de cada grupo basta con coincidir con uno; entre grupos, con todos.
 */
export interface CatalogFilter {
  /** Categorías elegidas ya expandidas con sus subcategorías. */
  categoryIds: ReadonlySet<number> | null;
  brandNames: ReadonlySet<string> | null;
  /** Sobre el precio detal (código RETAIL), nunca por la posición del precio. */
  priceRange: PriceRange | null;
}

export const NO_CATALOG_FILTER: CatalogFilter = { categoryIds: null, brandNames: null, priceRange: null };

export function retailPrice(item: CatalogProductListItem): number | null {
  return item.prices.find(price => price.priceTypeCode === PRICE_TYPE_CODES.retail)?.amount ?? null;
}

export function matchesCategories(item: CatalogProductListItem, categoryIds: ReadonlySet<number> | null): boolean {
  return !categoryIds || (item.categoryIds ?? []).some(id => categoryIds.has(id));
}

export function matchesBrands(item: CatalogProductListItem, brandNames: ReadonlySet<string> | null): boolean {
  return !brandNames || brandNames.has(item.brandName);
}

export function matchesPrice(item: CatalogProductListItem, range: PriceRange | null): boolean {
  if (!range) {
    return true;
  }

  const price = retailPrice(item);

  return price !== null && price >= range.min && price <= range.max;
}

export function filterCatalog(items: readonly CatalogProductListItem[], filter: CatalogFilter): CatalogProductListItem[] {
  return items.filter(
    item =>
      matchesCategories(item, filter.categoryIds) &&
      matchesBrands(item, filter.brandNames) &&
      matchesPrice(item, filter.priceRange)
  );
}

/** Orden estable: sin precio detal, al final; el API ya entrega por nombre. */
export function sortCatalog(items: CatalogProductListItem[], sort: ProductSort): CatalogProductListItem[] {
  if (sort === 'name') {
    return [...items].sort((first, second) => first.name.localeCompare(second.name, 'es'));
  }

  const direction = sort === 'price-asc' ? 1 : -1;

  return [...items].sort((first, second) => {
    const a = retailPrice(first);
    const b = retailPrice(second);

    if (a === null || b === null) {
      return a === b ? 0 : a === null ? 1 : -1;
    }

    return (a - b) * direction;
  });
}

/** Cada categoría con todas sus descendientes: elegir "Maquillaje" incluye "Labiales". */
export function collectSubtrees(menu: readonly CategoryMenuItem[]): Map<number, Set<number>> {
  const result = new Map<number, Set<number>>();

  const walk = (node: CategoryMenuItem): Set<number> => {
    const ids = new Set<number>([node.id]);

    for (const child of node.children) {
      for (const id of walk(child)) {
        ids.add(id);
      }
    }

    result.set(node.id, ids);

    return ids;
  };

  menu.forEach(walk);

  return result;
}
