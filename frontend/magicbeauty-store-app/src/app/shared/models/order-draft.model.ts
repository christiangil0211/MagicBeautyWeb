/**
 * Línea del pedido temporal. Guarda la identidad del producto y lo necesario para
 * pintarlo sin red, pero nunca precios: estos se consultan siempre a la API.
 * Es la misma estructura que usará el carrito del e-commerce.
 */
export interface OrderDraftLine {
  productId: number;
  reference: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  /** Null en productos sin tonos. */
  variantId: number | null;
  variantName: string | null;
  quantity: number;
}

/** Lo que se agrega desde la tarjeta o el detalle: la cantidad se indica aparte. */
export type OrderDraftItem = Omit<OrderDraftLine, 'quantity'>;

/** Tope técnico por línea (no comercial): evita cantidades absurdas por error de tipeo. */
export const MAX_LINE_QUANTITY = 999;

/** Un producto con tono distinto es otra línea. */
export function orderLineKey(line: Pick<OrderDraftLine, 'productId' | 'variantId'>): string {
  return `${line.productId}:${line.variantId ?? 0}`;
}
