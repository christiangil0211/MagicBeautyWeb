import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { ProductService } from '../../../core/services/product.service';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { ProductCardModel, toProductCard } from '../../../shared/models/product.model';

/**
 * Vitrina genérica de la tienda. Su única responsabilidad es decidir qué
 * productos se muestran y qué hacer con los eventos de la tarjeta: la
 * ProductCard no sabe que existe esta página.
 */
@Component({
  selector: 'app-public-products',
  imports: [ProductCardComponent, ToastModule],
  providers: [MessageService],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent {
  private readonly productService = inject(ProductService);
  private readonly messageService = inject(MessageService);

  readonly products = signal<ProductCardModel[]>([]);
  readonly loading = signal(true);
  readonly favorites = signal<Set<number>>(new Set());

  readonly cards = computed(() =>
    this.products().map(product => ({
      ...product,
      isFavorite: this.favorites().has(product.id)
    }))
  );

  constructor() {
    this.productService.getAll({ isActive: true }).subscribe({
      next: products => {
        this.products.set(products.map(toProductCard));
        this.loading.set(false);
      },
      error: () => {
        this.products.set([]);
        this.loading.set(false);
      }
    });
  }

  /** La tarjeta no conoce rutas: la página le indica a dónde lleva el producto. */
  detailLink(reference: string): unknown[] {
    return ['/productos', reference];
  }

  onAddToCart(product: ProductCardModel): void {
    // El módulo de carrito todavía no existe: por ahora solo se confirma la acción.
    this.messageService.add({
      severity: 'success',
      summary: 'Listo para el carrito',
      detail: product.name + ' se puede agregar directo porque no tiene tonos.'
    });
  }

  onChooseVariant(product: ProductCardModel): void {
    // Nunca se elige un tono por el cliente: esto llevará al detalle cuando exista.
    this.messageService.add({
      severity: 'info',
      summary: 'Elige un tono',
      detail: product.name + ' tiene varios tonos, hay que seleccionar uno antes de comprar.'
    });
  }

  onToggleFavorite(product: ProductCardModel): void {
    this.favorites.update(current => {
      const next = new Set(current);

      if (!next.delete(product.id)) {
        next.add(product.id);
      }

      return next;
    });
  }

}
