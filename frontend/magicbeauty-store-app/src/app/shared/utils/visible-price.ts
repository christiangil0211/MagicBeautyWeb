import { linkedSignal, Signal, WritableSignal } from '@angular/core';

import { CatalogPrice } from '../models/product.model';

/** Conserva el orden de la audiencia cuando su lista no contiene el tipo predeterminado. */
export function preferredVisiblePrice(prices: readonly CatalogPrice[]): CatalogPrice | undefined {
  return prices.find(price => price.isDefault) ?? prices[0];
}

/** Oculta los datos previos desde el momento en que cambia la audiencia, antes de recargar. */
export function priceAudienceState<T>(audience: Signal<string>, initialValue: T): WritableSignal<T> {
  return linkedSignal({ source: audience, computation: () => initialValue });
}
