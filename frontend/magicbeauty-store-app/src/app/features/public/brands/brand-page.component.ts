import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { SEO_DEFAULTS, toMetaDescription } from '../../../core/seo/seo.model';
import { SeoService } from '../../../core/seo/seo.service';
import { buildBrandPageJsonLd, buildBreadcrumbJsonLd } from '../../../core/seo/structured-data';
import { BrandService } from '../../../core/services/brand.service';
import { CategoryService } from '../../../core/services/category.service';
import { OrderDraftService } from '../../../core/services/order-draft.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { PublicBrandPage } from '../../../shared/models/brand.model';
import { CategoryMenuItem } from '../../../shared/models/category.model';
import { ProductCardModel, toProductCard } from '../../../shared/models/product.model';
import { NO_CATALOG_FILTER, ProductSort, collectSubtrees, filterCatalog, sortCatalog } from '../../../shared/utils/catalog-filters';

/** Título pedido para la página de cada marca. */
export function brandPageTitle(name: string): string {
  return `${name} en Cali al detal y por mayor | Magic Beauty Cosmetics`;
}

/**
 * Página pública de una marca: logo, nombre, descripción corta y sus productos
 * completos (con foto y precio al detal) con los filtros básicos del catálogo.
 * El HTML inicial con título, canonical y JSON-LD lo entrega la función de Static
 * Web Apps; aquí se aplican los mismos metadatos al navegar dentro de la app.
 */
@Component({
  selector: 'app-brand-page',
  imports: [RouterLink, ToastModule, ProductCardComponent, LoaderComponent, EmptyStateComponent, PaginationComponent],
  providers: [MessageService],
  templateUrl: './brand-page.component.html',
  styleUrl: './brand-page.component.scss'
})
export class BrandPageComponent {
  private readonly brandService = inject(BrandService);
  private readonly seo = inject(SeoService);
  private readonly orderDraft = inject(OrderDraftService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  /** Parámetro de la ruta /marcas/:slug. */
  readonly slug = input<string>('');

  readonly data = signal<PublicBrandPage | null>(null);
  readonly loading = signal(true);
  /** Solo un 404 del API confirma que la marca no existe (o está inactiva). */
  readonly notFound = signal(false);
  readonly loadFailed = signal(false);

  readonly categoryTree = signal<CategoryMenuItem[]>([]);
  readonly categoryId = signal<number | null>(null);
  readonly sort = signal<ProductSort>('name');
  readonly pageSize = 20;

  /** Solo las categorías raíz que tienen productos de esta marca. */
  readonly categoryOptions = computed(() => {
    const products = this.data()?.products ?? [];
    const subtrees = collectSubtrees(this.categoryTree());
    return this.categoryTree()
      .map(category => ({
        id: category.id,
        name: category.name,
        count: products.filter(product => product.categoryIds.some(id => subtrees.get(category.id)?.has(id))).length
      }))
      .filter(option => option.count > 0);
  });

  readonly filtered = computed(() => {
    const products = this.data()?.products ?? [];
    const categoryId = this.categoryId();
    const categoryIds = categoryId == null ? null : (collectSubtrees(this.categoryTree()).get(categoryId) ?? new Set([categoryId]));
    return sortCatalog(filterCatalog(products, { ...NO_CATALOG_FILTER, categoryIds }), this.sort()).map(toProductCard);
  });

  readonly page = linkedSignal(() => {
    this.filtered();
    return 1;
  });

  readonly pagedCards = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  constructor() {
    inject(CategoryService)
      .getCatalogTree()
      .subscribe({ next: tree => this.categoryTree.set(tree), error: () => this.categoryTree.set([]) });

    effect(() => {
      const slug = this.slug();
      untracked(() => this.load(slug));
    });

    effect(() => {
      this.seo.navigation();

      if (this.notFound()) {
        this.seo.apply({ title: 'Marca no encontrada · Magic Beauty Cosmetics', noindex: true });
        return;
      }

      const data = this.data();
      if (data && !this.loading()) {
        this.applySeo(data);
      }
    });
  }

  retry(): void {
    this.load(this.slug());
  }

  goToPage(page: number): void {
    this.page.set(page);
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  selectCategory(value: string): void {
    this.categoryId.set(value ? Number(value) : null);
  }

  selectSort(value: string): void {
    this.sort.set(value as ProductSort);
  }

  onAddToCart(product: ProductCardModel): void {
    this.orderDraft.add({
      productId: product.id,
      reference: product.reference,
      name: product.name,
      brandName: product.brandName,
      imageUrl: product.mainImageUrl ?? null,
      variantId: null,
      variantName: null
    });
    this.messageService.add({ severity: 'success', summary: 'Agregado a tu pedido', detail: product.name + ' ya está en Mi pedido.' });
  }

  onChooseVariant(product: ProductCardModel): void {
    this.router.navigate(['/catalogo', product.reference]);
  }

  private load(slug: string): void {
    if (!slug) return;

    this.loading.set(true);
    this.notFound.set(false);
    this.loadFailed.set(false);
    this.categoryId.set(null);

    this.brandService.getPublicBrand(slug).subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: error => {
        this.data.set(null);
        // Un error o una demora del API nunca se presentan como "no existe".
        if (error instanceof HttpErrorResponse && error.status === 404) this.notFound.set(true);
        else this.loadFailed.set(true);
        this.loading.set(false);
      }
    });
  }

  private applySeo(data: PublicBrandPage): void {
    const brand = data.brand;
    const path = '/marcas/' + encodeURIComponent(brand.slug);
    // Open Graph no admite SVG: en ese caso se usa la imagen de la tienda.
    const image = brand.logoUrl && !/\.svg(\?|$)/i.test(brand.logoUrl) ? brand.logoUrl : SEO_DEFAULTS.image;

    this.seo.apply({
      title: brandPageTitle(brand.name),
      description: toMetaDescription(
        brand.description?.trim() ||
          `Compra ${brand.name} en Magic Beauty Cosmetics, Cali: ${data.total} producto${data.total === 1 ? '' : 's'} al detal y por mayor. Arma tu pedido y envíalo por WhatsApp.`
      ),
      path,
      image,
      imageAlt: brand.logoUrl ? 'Logo de ' + brand.name : SEO_DEFAULTS.imageAlt,
      jsonLd: {
        page: buildBrandPageJsonLd(brand, data.products),
        breadcrumb: buildBreadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Marcas', path: '/marcas' },
          { name: brand.name, path }
        ])
      }
    });
  }
}
