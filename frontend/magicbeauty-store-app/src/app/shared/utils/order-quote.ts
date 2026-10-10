import { OrderDraftLine, orderLineKey } from '../models/order-draft.model';
import { PRICE_TYPE_CODES } from '../models/price-type.model';
import { CatalogPrice, CatalogProductListItem, ProductDetail } from '../models/product.model';

export type QuoteKind = 'retail' | 'wholesale';

/**
 * Cada cotización usa exclusivamente su tipo de precio, buscado por código: nunca
 * por la posición en que la API devuelve los precios.
 */
export const QUOTE_KINDS: Record<QuoteKind, { label: string; priceTypeCode: string }> = {
  retail: { label: 'Cotización detal', priceTypeCode: PRICE_TYPE_CODES.retail },
  wholesale: { label: 'Cotización mayorista', priceTypeCode: PRICE_TYPE_CODES.wholesale }
};

/**
 * - available: se puede cotizar (sin mirar existencias: las confirma el equipo).
 * - unavailable: desactivado, retirado o tono que ya no existe.
 */
export type OrderLineStatus = 'available' | 'unavailable';

/** Estado fresco de una línea según la API. */
export interface OrderLineAvailability {
  status: OrderLineStatus;
  prices: CatalogPrice[];
}

export interface QuoteLine {
  key: string;
  line: OrderDraftLine;
  status: OrderLineStatus;
  /** Null si el producto no tiene precio de este tipo (o no es visible para quien consulta). */
  unitPrice: number | null;
  subtotal: number | null;
}

export interface OrderQuote {
  kind: QuoteKind;
  label: string;
  lines: QuoteLine[];
  /** Suma de las líneas disponibles que tienen precio de este tipo. */
  total: number;
  /** Líneas disponibles con precio: entran al total. */
  pricedCount: number;
  /** Líneas disponibles sin precio de este tipo: no entran al total. */
  missingPriceCount: number;
  /** Líneas de productos que ya no están en el catálogo: no se cotizan. */
  excludedCount: number;
}

/**
 * Cruza el pedido con el catálogo vigente: precios actuales y si el producto (o
 * su tono) sigue publicado. Las existencias no cuentan: se cotiza todo y la
 * disponibilidad la confirma el equipo al recibir el pedido.
 */
export function resolveOrderAvailability(
  lines: readonly OrderDraftLine[],
  products: readonly CatalogProductListItem[],
  details: ReadonlyMap<string, ProductDetail | null>
): Map<string, OrderLineAvailability> {
  const productsById = new Map(products.map(product => [product.id, product]));
  const result = new Map<string, OrderLineAvailability>();

  for (const line of lines) {
    const product = productsById.get(line.productId);
    let availability: OrderLineAvailability;

    if (!product) {
      availability = { status: 'unavailable', prices: [] };
    } else if (line.variantId === null) {
      // Si el producto pasó a tener tonos, la línea sin tono ya no identifica qué pedir.
      availability = product.hasVariants
        ? { status: 'unavailable', prices: product.prices }
        : { status: 'available', prices: product.prices };
    } else {
      const variant = details.get(line.reference)?.variants.find(item => item.id === line.variantId);

      availability = variant
        ? { status: 'available', prices: product.prices }
        : { status: 'unavailable', prices: product.prices };
    }

    result.set(orderLineKey(line), availability);
  }

  return result;
}

/** Arma una cotización: sin precio de su tipo, la línea queda "por confirmar" y no suma. */
export function buildOrderQuote(
  lines: readonly OrderDraftLine[],
  availability: ReadonlyMap<string, OrderLineAvailability>,
  kind: QuoteKind
): OrderQuote {
  const { label, priceTypeCode } = QUOTE_KINDS[kind];
  let total = 0;
  let pricedCount = 0;
  let missingPriceCount = 0;
  let excludedCount = 0;

  const quoteLines = lines.map<QuoteLine>(line => {
    const key = orderLineKey(line);
    const state: OrderLineAvailability = availability.get(key) ?? { status: 'unavailable', prices: [] };
    const isAvailable = state.status === 'available';
    const unitPrice = isAvailable
      ? (state.prices.find(price => price.priceTypeCode === priceTypeCode)?.amount ?? null)
      : null;
    const subtotal = unitPrice === null ? null : roundMoney(unitPrice * line.quantity);

    if (!isAvailable) {
      excludedCount++;
    } else if (subtotal === null) {
      missingPriceCount++;
    } else {
      pricedCount++;
      total += subtotal;
    }

    return {
      key,
      line,
      status: state.status,
      unitPrice,
      subtotal
    };
  });

  return {
    kind,
    label,
    lines: quoteLines,
    total: roundMoney(total),
    pricedCount,
    missingPriceCount,
    excludedCount
  };
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
