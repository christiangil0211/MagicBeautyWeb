import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, PLATFORM_ID, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Subscription } from 'rxjs';

import { publicBrandName, toMetaDescription } from '../../../core/seo/seo.model';
import { SeoService } from '../../../core/seo/seo.service';
import { buildBreadcrumbJsonLd, buildProductJsonLd, isCompleteProduct } from '../../../core/seo/structured-data';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { OrderDraftService } from '../../../core/services/order-draft.service';
import { MAX_LINE_QUANTITY } from '../../../shared/models/order-draft.model';
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
import { priceAudienceState } from '../../../shared/utils/visible-price';

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
  private readonly orderDraft = inject(OrderDraftService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly auth = inject(AuthService);
  private readonly audience = this.auth.priceAudienceKey;
  private readonly refresh = signal(0);

  /** Referencia que llega de la ruta /catalogo/:reference (withComponentInputBinding). */
  readonly reference = input.required<string>();

  /**
   * Los favoritos aún no se guardan: el corazón queda oculto en el portal. El
   * e-commerce lo activa con `data: { showFavorite: true }` en su ruta.
   */
  readonly showFavorite = input(false);

  /**
   * Cotización (portal, `data: { quoteMode: true }`): no se muestran existencias y
   * se puede pedir cualquier tono y cantidad; la disponibilidad la confirma el
   * equipo al recibir el pedido.
   */
  readonly quoteMode = input(false);

  readonly product = priceAudienceState<ProductDetail | null>(this.audience, null);
  readonly loading = priceAudienceState(this.audience, true);
  /** El API respondió 404: el producto no existe o está inactivo. */
  readonly notFound = priceAudienceState(this.audience, false);
  /**
   * El API falló o no respondió (caído, lento, sin red). No se sabe si el producto
   * existe, así que la página no se marca `noindex`: se ofrece reintentar.
   */
  readonly loadFailed = priceAudienceState(this.audience, false);

  readonly selectedVariantId = signal<number | null>(null);
  readonly selectedImageId = signal<number | null>(null);
  readonly quantity = signal(1);
  readonly isFavorite = signal(false);

  readonly related = priceAudienceState<ProductCardModel[]>(this.audience, []);

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

    if (this.quoteMode()) {
      return MAX_LINE_QUANTITY;
    }

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
  readonly isSoldOut = computed(() => !this.quoteMode() && (this.product()?.availableQuantity ?? 0) === 0);

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

    return this.quoteMode() ? 'Agregar a cotización' : 'Agregar al pedido';
  });

  /** Tono sin existencias: solo bloquea fuera de la cotización. */
  isVariantOut(variant: ProductDetailVariant): boolean {
    return !this.quoteMode() && variant.quantity === 0;
  }

  /** Categoría del breadcrumb: la primera por nombre, para que sea estable. */
  readonly breadcrumbCategory = computed(() => this.product()?.categories[0] ?? null);

  constructor() {
    effect(onCleanup => {
      const reference = this.reference();
      const audience = this.audience();
      this.refresh();

      if (reference && audience !== 'checking') {
        const subscription = untracked(() => this.load(reference, audience));
        onCleanup(() => subscription.unsubscribe());
      }
    });

    // Metadatos de la ficha: se aplican encima de los de la ruta cuando llega el producto.
    effect(() => {
      this.seo.navigation();

      // Solo un 404 del API confirma que no existe. Un error o una demora no
      // cambian los metadatos: quedan los de la ruta (index, follow).
      if (this.notFound()) {
        this.seo.apply({ title: 'Producto no encontrado · Magic Beauty Cosmetics', noindex: true });
        return;
      }

      const product = this.product();

      if (product && !this.loading()) {
        this.applySeo(product);
      }
    });
  }

  selectVariant(variant: ProductDetailVariant): void {
    if (this.isVariantOut(variant)) {
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
    const product = this.product();
    if (!product || !this.canAddToCart()) {
      return;
    }

    const variant = this.selectedVariant();

    this.orderDraft.add(
      {
        productId: product.id,
        reference: product.reference,
        name: product.name,
        brandName: product.brandName,
        imageUrl: this.selectedImage()?.url ?? null,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null
      },
      this.quantity()
    );

    this.messageService.add({
      severity: 'success',
      summary: 'Agregado a tu pedido',
      detail: this.quantity() + ' x ' + product.name + (variant ? ' · ' + variant.name : '') + '.'
    });
  }

  toggleFavorite(): void {
    this.isFavorite.update(value => !value);
  }

  /** Nunca se elige un tono por el cliente: se abre su ficha para elegirlo. */
  openRelated(product: ProductCardModel): void {
    this.router.navigate(this.detailLink(product.reference));
  }

  addRelatedToCart(product: ProductCardModel): void {
    this.orderDraft.add({
      productId: product.id,
      reference: product.reference,
      name: product.name,
      brandName: product.brandName,
      imageUrl: product.mainImageUrl ?? null,
      variantId: null,
      variantName: null
    });

    this.messageService.add({
      severity: 'success',
      summary: 'Agregado a tu pedido',
      detail: product.name + ' ya está en Mi pedido.'
    });
  }

  detailLink(reference: string): unknown[] {
    return ['/catalogo', reference];
  }

  private applySeo(product: ProductDetail): void {
    const path = '/catalogo/' + encodeURIComponent(product.reference);
    const category = product.categories[0];
    const image = product.images.find(item => item.productVariantId == null);
    const brand = publicBrandName(product.brandName);
    // El SEO inicial lo genera un lector anónimo; una tarifa de sesión no es una oferta pública.
    const seoProduct = this.isBrowser && this.auth.session()?.isAuthenticated !== false ? { ...product, prices: [] } : product;

    this.seo.apply({
      title: [product.name, brand].filter(part => part).join(' · ') + ' en Cali · Magic Beauty Cosmetics',
      description: toMetaDescription(
        product.description?.trim() ||
          `${product.name}${brand ? ' de ' + brand : ''} (ref. ${product.reference}) en Magic Beauty Cosmetics, Cali. Consulta precios al detal y al por mayor y pide por WhatsApp.`
      ),
      path,
      // La ficha pública es la del portal; la de la tienda con sesión no se indexa.
      // Una ficha incompleta (sin foto o sin precio al detal) tampoco, hasta completarla:
      // es el mismo criterio del sitemap.
      noindex: !this.router.url.startsWith('/catalogo/') || !isCompleteProduct(product),
      type: 'product',
      image: image?.url,
      imageAlt: image?.altText || product.name,
      jsonLd: {
        product: buildProductJsonLd(seoProduct, path),
        breadcrumb: buildBreadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Catálogo digital', path: '/catalogo' },
          ...(category ? [{ name: category.name, path: '/catalogo/categoria/' + category.slug }] : []),
          { name: product.name, path }
        ])
      }
    });
  }

  private load(reference: string, audience: string): Subscription {
    this.loading.set(true);
    this.product.set(null);
    this.related.set([]);
    this.notFound.set(false);
    this.loadFailed.set(false);
    this.selectedVariantId.set(null);
    this.selectedImageId.set(null);
    this.quantity.set(1);

    const subscription = new Subscription();
    subscription.add(this.catalogService.getProductDetail(reference).subscribe({
      next: product => {
        if (this.audience() !== audience || this.reference() !== reference) return;

        this.product.set(product);
        this.loading.set(false);
        subscription.add(this.loadRelated(product, reference, audience));
      },
      error: (error: unknown) => {
        if (this.audience() !== audience || this.reference() !== reference) return;

        this.product.set(null);
        this.loading.set(false);

        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.notFound.set(true);
        } else {
          this.loadFailed.set(true);
        }
      }
    }));
    return subscription;
  }

  /** Vuelve a pedir el producto después de un error del API. */
  retry(): void {
    this.refresh.update(current => current + 1);
  }

  /** Unos pocos productos de la misma categoría: la ficha no descarga el catálogo entero. */
  private loadRelated(product: ProductDetail, reference: string, audience: string): Subscription | undefined {
    // Solo en el navegador: el servidor no debe esperar el catálogo completo para
    // entregar la ficha, que es lo que importa para el SEO.
    if (!this.isBrowser) {
      return;
    }

    return this.catalogService.getRelatedProducts(product.reference, RELATED_LIMIT).subscribe({
      next: products => {
        if (this.audience() === audience && this.reference() === reference) {
          this.related.set(products.slice(0, RELATED_LIMIT).map(toProductCard));
        }
      },
      error: () => {
        if (this.audience() === audience && this.reference() === reference) this.related.set([]);
      }
    });
  }
}
