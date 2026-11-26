import { CatalogProductListItem } from '../../../shared/models/product.model';

/** Cuántos productos muestra "Productos favoritos" del inicio. */
export const HOME_FAVORITES_MAX = 16;

/** Ningún grupo de categoría acapara la sección. */
export const HOME_FAVORITES_PER_CATEGORY = 4;

/**
 * Producto que puede salir en el inicio: con foto, precio detal y existencias.
 * La marca no es obligatoria (los accesorios sin marca también salen). Esto
 * solo filtra el inicio: fichas y catálogo muestran "Agotado" como siempre.
 */
export function isHomeReady(product: CatalogProductListItem): boolean {
  return (
    !!product.mainImageUrl &&
    product.availableQuantity > 0 &&
    product.prices.some(price => price.priceTypeCode === 'RETAIL' && price.amount > 0)
  );
}

/**
 * Elige los favoritos del inicio. Mientras no exista el "destacado" administrable
 * (fase C), el criterio es automático: productos listos para el inicio, en un
 * orden que cambia cada día (`seed`), con máximo cuatro por categoría para que haya
 * variedad.
 */
export function pickHomeFavorites(
  products: readonly CatalogProductListItem[],
  seed: string,
  max = HOME_FAVORITES_MAX,
  perCategory = HOME_FAVORITES_PER_CATEGORY
): CatalogProductListItem[] {
  const random = seededRandom(seed);
  const candidates = products.filter(isHomeReady);

  // Fisher-Yates con semilla: el mismo día, la misma selección.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const perGroup = new Map<string, number>();
  const picked: CatalogProductListItem[] = [];

  for (const product of candidates) {
    if (picked.length >= max) break;

    const group = categoryGroup(product);
    const count = perGroup.get(group) ?? 0;

    if (count >= perCategory) continue;

    perGroup.set(group, count + 1);
    picked.push(product);
  }

  return picked;
}

/** Generador pseudoaleatorio determinista (mulberry32) a partir de un texto. */
function seededRandom(seed: string): () => number {
  let state = 0;
  for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grupo de variedad de un producto: su categoría de menor Id, o "sin categoría". */
export function categoryGroup(product: CatalogProductListItem): string {
  return product.categoryIds.length ? String(Math.min(...product.categoryIds)) : 'sin-categoria';
}
