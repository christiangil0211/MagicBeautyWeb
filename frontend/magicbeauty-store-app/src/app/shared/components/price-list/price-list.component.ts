import { Component, computed, input } from '@angular/core';

import { CatalogPrice } from '../../models/product.model';

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

/**
 * Pinta los precios que el backend autorizó para quien navega. No conoce ningún
 * código de precio: un tipo nuevo aparece sin tocar este componente. El primero
 * de la lista se destaca solo por su posición, que también define el backend.
 */
@Component({
  selector: 'app-price-list',
  templateUrl: './price-list.component.html',
  styleUrl: './price-list.component.scss',
  host: {
    '[class.price-list--large]': "size() === 'large'"
  }
})
export class PriceListComponent {
  readonly prices = input.required<CatalogPrice[]>();

  /** compact para tarjetas, large para la ficha del producto. */
  readonly size = input<'compact' | 'large'>('compact');

  readonly items = computed(() =>
    this.prices().map(price => ({
      code: price.priceTypeCode,
      name: price.priceTypeName,
      formatted: currencyFormatter.format(price.amount)
    }))
  );
}
