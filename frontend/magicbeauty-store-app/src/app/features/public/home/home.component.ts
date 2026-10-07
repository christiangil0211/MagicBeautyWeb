import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { CategoryService } from '../../../core/services/category.service';
import { ProductService } from '../../../core/services/product.service';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { CategoryTile } from '../../../shared/models/category.model';
import { ProductCardModel, toProductCard } from '../../../shared/models/product.model';

/** Cuántos productos muestra la sección comercial del inicio. */
const FAVORITES_LIMIT = 5;

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCardComponent, ToastModule],
  providers: [MessageService],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private readonly categoryService = inject(CategoryService);
  private readonly productService = inject(ProductService);
  private readonly messageService = inject(MessageService);

  readonly tiles = signal<CategoryTile[]>([]);
  readonly loaded = signal(false);

  readonly favoriteProducts = signal<ProductCardModel[]>([]);
  readonly productsLoading = signal(true);
  readonly favorites = signal<Set<number>>(new Set());

  readonly favoriteCards = computed(() =>
    this.favoriteProducts().map(product => ({
      ...product,
      isFavorite: this.favorites().has(product.id)
    }))
  );

  constructor() {
    this.categoryService.getHomeTiles().subscribe({
      next: tiles => {
        this.tiles.set(tiles);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true)
    });

    // Todavía no hay un campo "destacado" en el catálogo: por ahora la sección
    // muestra los primeros productos activos disponibles.
    this.productService.getAll({ isActive: true }).subscribe({
      next: products => {
        this.favoriteProducts.set(products.slice(0, FAVORITES_LIMIT).map(toProductCard));
        this.productsLoading.set(false);
      },
      // Si el catálogo falla, el resto del inicio sigue en pie.
      error: () => {
        this.favoriteProducts.set([]);
        this.productsLoading.set(false);
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

  categoryPath(slug: string): string {
    return '/categoria/' + slug;
  }
}
