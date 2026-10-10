import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';

import {
  MAX_LINE_QUANTITY,
  OrderDraftItem,
  OrderDraftLine,
  orderLineKey
} from '../../shared/models/order-draft.model';

/** Versionada: si la estructura cambia, un pedido viejo se descarta en vez de romper la página. */
export const ORDER_STORAGE_KEY = 'mb.order.v1';

interface StoredOrder {
  version: 1;
  lines: OrderDraftLine[];
}

/**
 * Pedido temporal compartido por las pestañas. Vive en memoria (señales) y se
 * copia a localStorage para sobrevivir a recargas. No conoce precios: la
 * cotización se calcula aparte con datos frescos de la API.
 *
 * Está pensado como el futuro carrito: cambiar la persistencia por un API no
 * obliga a tocar a quienes lo usan.
 */
@Injectable({
  providedIn: 'root'
})
export class OrderDraftService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly linesState = signal<OrderDraftLine[]>([]);

  readonly lines = this.linesState.asReadonly();

  /** Unidades totales: es el número que muestra el contador. */
  readonly itemCount = computed(() => this.linesState().reduce((total, line) => total + line.quantity, 0));

  readonly isEmpty = computed(() => this.linesState().length === 0);

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    // Tras el primer render: con SSR el servidor pinta el pedido vacío y leerlo
    // antes descuadraría la hidratación.
    afterNextRender(() => this.restore());

    // Otra pestaña del navegador cambió el pedido: se refleja aquí también.
    const onStorage = (event: StorageEvent) => {
      if (event.key === ORDER_STORAGE_KEY) {
        this.restore();
      }
    };

    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  /** Suma a la línea existente (mismo producto y tono) o crea una nueva. */
  add(item: OrderDraftItem, quantity = 1): void {
    const amount = normalizeQuantity(quantity);
    const key = orderLineKey(item);

    this.update(lines => {
      const existing = lines.find(line => orderLineKey(line) === key);

      if (!existing) {
        return [...lines, { ...item, quantity: amount }];
      }

      // Se refrescan nombre e imagen por si cambiaron desde que se agregó.
      return lines.map(line =>
        orderLineKey(line) === key
          ? { ...line, ...item, quantity: Math.min(line.quantity + amount, MAX_LINE_QUANTITY) }
          : line
      );
    });
  }

  setQuantity(key: string, quantity: number): void {
    const amount = normalizeQuantity(quantity);

    this.update(lines => lines.map(line => (orderLineKey(line) === key ? { ...line, quantity: amount } : line)));
  }

  remove(key: string): void {
    this.update(lines => lines.filter(line => orderLineKey(line) !== key));
  }

  clear(): void {
    this.update(() => []);
  }

  private update(change: (lines: OrderDraftLine[]) => OrderDraftLine[]): void {
    this.linesState.update(change);
    this.persist();
  }

  private persist(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      const lines = this.linesState();

      if (lines.length === 0) {
        localStorage.removeItem(ORDER_STORAGE_KEY);
      } else {
        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, lines } satisfies StoredOrder));
      }
    } catch {
      // Navegación privada o almacenamiento lleno: el pedido sigue en memoria.
    }
  }

  private restore(): void {
    try {
      this.linesState.set(parseStoredOrder(localStorage.getItem(ORDER_STORAGE_KEY)));
    } catch {
      this.linesState.set([]);
    }
  }
}

function normalizeQuantity(quantity: number): number {
  return Number.isFinite(quantity) ? Math.min(Math.max(Math.trunc(quantity), 1), MAX_LINE_QUANTITY) : 1;
}

/**
 * localStorage lo puede editar cualquiera: solo se aceptan líneas bien formadas y
 * se descarta todo lo demás (incluido cualquier precio, que aquí no existe).
 */
export function parseStoredOrder(raw: string | null): OrderDraftLine[] {
  if (!raw) {
    return [];
  }

  const stored = JSON.parse(raw) as Partial<StoredOrder> | null;

  if (stored?.version !== 1 || !Array.isArray(stored.lines)) {
    return [];
  }

  const lines = new Map<string, OrderDraftLine>();

  for (const candidate of stored.lines as unknown[]) {
    const line = toLine(candidate);

    if (line && !lines.has(orderLineKey(line))) {
      lines.set(orderLineKey(line), line);
    }
  }

  return [...lines.values()];
}

function toLine(value: unknown): OrderDraftLine | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const line = value as Record<string, unknown>;
  const isId = (id: unknown): id is number => Number.isInteger(id) && (id as number) > 0;
  const text = (field: unknown): string | null => (typeof field === 'string' ? field : null);

  if (!isId(line['productId']) || !text(line['reference']) || !text(line['name'])) {
    return null;
  }

  const variantId = line['variantId'] == null ? null : line['variantId'];

  if (variantId !== null && !isId(variantId)) {
    return null;
  }

  return {
    productId: line['productId'],
    reference: text(line['reference'])!,
    name: text(line['name'])!,
    brandName: text(line['brandName']) ?? '',
    imageUrl: text(line['imageUrl']),
    variantId,
    variantName: variantId === null ? null : text(line['variantName']),
    quantity: normalizeQuantity(Number(line['quantity']))
  };
}
