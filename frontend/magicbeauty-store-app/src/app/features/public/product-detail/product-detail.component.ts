import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { CatalogService } from '../../../core/services/catalog.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PriceListComponent } from '../../../shared/components/price-list/price-list.component';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import {
  ProductCardModel,
  ProductDetail,
  ProductDetailImage,
  ProductDetailVariant,
  toProductCard
} from '../../../shared/models/product.model';

/** Cuántos productos acompañan la ficha. */
const RELATED_LIMIT = 5;

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, PriceListComponent, ProductCardComponent, LoaderComponent, EmptyStateComponent, ToastModule],
  providers: [MessageService],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss'
})
export class ProductDetailComponent {
  private readonly catalogService = inject(CatalogService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly messageService = inject(MessageService);

  /** Referencia que llega de la ruta /productos/:reference (withComponentInputBinding). */
  readonly reference = input.required<string>();

  readonly product = signal<ProductDetail | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  readonly selectedVariantId = signal<number | null>(null);
  readonly selectedImageId = signal<number | null>(null);
  readonly quantity = signal(1);
  readonly isFavorite = signal(false);

  readonly related = signal<ProductCardModel[]>([]);

  readonly selectedVariant = computed<ProductDetailVariant | null>(() => {
    const id = this.selectedVariantId();

    return id === null ? null : (this.product()?.variants.find(v => v.id === id) ?? null);
  });

  /**
   * Galería visible: las imágenes generales siempre, más las del tono elegido.
   * Mientras no se elija tono no se muestran imágenes de un tono concreto.
   */
  readonly gallery = computed<ProductDetailImage[]>(() => {
    const images = this.product()?.images ?? [];
    const variantId = this.selectedVariantId();

    return images.filter(
      image => image.productVariantId == null || image.productVariantId === variantId
    );
  });

  readonly selectedImage = computed<ProductDetailImage | null>(() => {
    const gallery = this.gallery();

    if (gallery.length === 0) {
      return null;
    }

    return gallery.find(image => image.id === this.selectedImageId()) ?? gallery[0];
  });

  /** Existencias del contexto actual: del tono elegido o del producto entero. */
  readonly availableStock = computed(() => {
    const product = this.product();

    if (!product) {
      return 0;
    }

    if (!product.hasVariants) {
      return product.availableQuantity;
    }

    return this.selectedVariant()?.quantity ?? 0;
  });

  readonly needsVariantChoice = computed(
    () => (this.product()?.hasVariants ?? false) && this.selectedVariantId() === null
  );

  /** Agotado es no tener existencias en ninguna variante activa. */
  readonly isSoldOut = computed(() => (this.product()?.availableQuantity ?? 0) === 0);

  readonly canAddToCart = computed(
    () => !this.isSoldOut() && !this.needsVariantChoice() && this.availableStock() > 0
  );

  readonly ctaLabel = computed(() => {
    if (this.isSoldOut()) {
      return 'Agotado';
    }

    if (this.needsVariantChoice()) {
      return 'Selecciona un tono';
    }

    return 'Agregar al carrito';
  });

  /** Categoría del breadcrumb: la primera por nombre, para que sea estable. */
  readonly breadcrumbCategory = computed(() => this.product()?.categories[0] ?? null);

  constructor() {
    effect(() => {
      const reference = this.reference();

      if (reference) {
        this.load(reference);
      }
    });
  }

  selectVariant(variant: ProductDetailVariant): void {
    if (variant.quantity === 0) {
      return;
    }

    this.selectedVariantId.set(variant.id);
    this.selectedImageId.set(null);
    this.quantity.set(1);
  }

  selectImage(image: ProductDetailImage): void {
    this.selectedImageId.set(image.id);
  }

  decrease(): void {
    this.quantity.update(current => Math.max(1, current - 1));
  }

  increase(): void {
    const max = this.availableStock();

    this.quantity.update(current => (current < max ? current + 1 : current));
  }

  addToCart(): void {
    if (!this.canAddToCart()) {
      return;
    }

    const variant = this.selectedVariant();

    // El módulo de carrito todavía no existe: por ahora solo se confirma la acción.
    this.messageService.add({
      severity: 'success',
      summary: 'Listo para el carrito',
      detail:
        this.quantity() +
        ' x ' +
        this.product()!.name +
        (variant ? ' · ' + variant.name : '') +
        '.'
    });
  }

  toggleFavorite(): void {
    this.isFavorite.update(value => !value);
  }

  openRelated(product: ProductCardModel): void {
    // Nunca se elige un tono por el cliente: debe hacerlo en la ficha del producto.
    this.messageService.add({
      severity: 'info',
      summary: 'Elige un tono',
      detail: product.name + ' tiene varios tonos, hay que seleccionar uno antes de comprar.'
    });
  }

  addRelatedToCart(product: ProductCardModel): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Listo para el carrito',
      detail: product.name + ' se puede agregar directo porque no tiene tonos.'
    });
  }

  detailLink(reference: string): unknown[] {
    return ['/productos', reference];
  }

  private load(reference: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.selectedVariantId.set(null);
    this.selectedImageId.set(null);
    this.quantity.set(1);

    this.catalogService.getProductDetail(reference).subscribe({
      next: product => {
        this.product.set(product);
        this.loading.set(false);
        this.loadRelated(product);
      },
      error: () => {
        this.product.set(null);
        this.loading.set(false);
        this.notFound.set(true);
      }
    });
  }

  /**
   * No hay endpoint de relacionados y no vale la pena crearlo todavía: se toma
   * el catálogo activo y se excluye el producto que se está viendo.
   */
  private loadRelated(product: ProductDetail): void {
    // Solo en el navegador: el servidor no debe esperar el catálogo completo para
    // entregar la ficha, que es lo que importa para el SEO.
    if (!this.isBrowser) {
      return;
    }

    this.catalogService.getProducts().subscribe({
      next: products => {
        this.related.set(
          products
            .filter(item => item.reference !== product.reference)
            .slice(0, RELATED_LIMIT)
            .map(toProductCard)
        );
      },
      error: () => this.related.set([])
    });
  }
}
