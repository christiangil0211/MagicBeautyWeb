import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductCardModel } from '../../models/product.model';
import { PriceListComponent } from '../price-list/price-list.component';

/**
 * Tarjeta pública de producto. Es genérica a propósito: no sabe si la pintan el
 * home, una categoría, una búsqueda o una lista de relacionados. La página padre
 * decide qué productos mostrar y qué hacer con los eventos.
 *
 * Recibe los precios ya filtrados por el backend y los delega a PriceList: la
 * misma tarjeta sirve para el público, mayoristas o distribuidores.
 */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, PriceListComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent {
  readonly product = input.required<ProductCardModel>();

  /**
   * Ruta al detalle. Se recibe desde fuera para no acoplar la tarjeta a una
   * página concreta: mientras el detalle no exista, se deja sin enlace.
   */
  readonly detailLink = input<unknown[] | string | null>(null);

  /** Texto del botón para productos sin tonos: carrito en el e-commerce, pedido en el portal. */
  readonly addLabel = input('Agregar al carrito');

  /** Los favoritos aún no se guardan: la página decide si muestra el corazón. */
  readonly showFavorite = input(true);

  /** Referencia bajo el nombre (útil para pedir por WhatsApp). */
  readonly showReference = input(false);

  /** Precios uno bajo otro o lado a lado (detal y mayorista en el portal). */
  readonly priceLayout = input<'stack' | 'columns'>('stack');

  /** Producto sin tonos y con existencias: se puede agregar directo. */
  readonly addToCart = output<ProductCardModel>();

  /**
   * Producto con tonos: nunca se elige uno automáticamente, el cliente debe
   * seleccionarlo explícitamente en el detalle.
   */
  readonly chooseVariant = output<ProductCardModel>();

  readonly toggleFavorite = output<ProductCardModel>();

  /**
   * Cotización (portal): no se muestran existencias y todo se puede agregar; la
   * disponibilidad la confirma el equipo al recibir el pedido.
   */
  readonly ignoreStock = input(false);

  readonly isSoldOut = computed(() => !this.ignoreStock() && !this.product().inStock);

  readonly actionLabel = computed(() => {
    if (this.isSoldOut()) {
      return 'Agotado';
    }

    return this.product().hasVariants ? 'Elegir tono' : this.addLabel();
  });

  readonly actionIcon = computed(() => {
    if (this.isSoldOut()) {
      return 'pi pi-ban';
    }

    return this.product().hasVariants ? 'pi pi-palette' : 'pi pi-shopping-cart';
  });

  onAction(): void {
    const product = this.product();

    if (this.isSoldOut()) {
      return;
    }

    if (product.hasVariants) {
      this.chooseVariant.emit(product);

      return;
    }

    this.addToCart.emit(product);
  }

  onToggleFavorite(event: Event): void {
    // El corazón vive dentro del área enlazable: sin esto navegaría al detalle.
    event.preventDefault();
    event.stopPropagation();

    this.toggleFavorite.emit(this.product());
  }
}
