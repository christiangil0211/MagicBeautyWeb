import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, combineLatest, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { ToastModule } from 'primeng/toast';

import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { OrderDraftService } from '../../../core/services/order-draft.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { CatalogProductListItem, ProductCardModel, toProductCard } from '../../../shared/models/product.model';
import {
  CatalogFilter,
  NO_CATALOG_FILTER,
  ProductSort,
  filterCatalog,
  sortCatalog
} from '../../../shared/utils/catalog-filters';

/**
 * Vitrina genérica de la tienda. Su única responsabilidad es decidir qué
 * productos se muestran y qué hacer con los eventos de la tarjeta: la
 * ProductCard no sabe que existe esta página.
 */
@Component({
  selector: 'app-public-products',
  imports: [
    RouterLink,
    ProductCardComponent,
    LoaderComponent,
    EmptyStateComponent,
    PaginationComponent,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent {
  private readonly catalogService = inject(CatalogService);
  private readonly messageService = inject(MessageService);
  private readonly orderDraft = inject(OrderDraftService);
  private readonly router = inject(Router);

  /** Las pistas de administración solo se muestran a quien puede administrar. */
  readonly canManageStore = inject(AuthService).canManageStore;

  /** Listado tal como lo entregó el API (búsqueda y categoría del servidor aplicadas). */
  readonly items = signal<CatalogProductListItem[]>([]);
  readonly loading = signal(true);
  readonly favorites = signal<Set<number>>(new Set());

  /** Texto buscado desde la cabecera (?q=). Vacío muestra todo el catálogo. */
  readonly searchTerm = signal('');
  readonly categoryId = input<number | null>(null);
  readonly hideHeading = input(false);

  /** Dentro de otra página (catálogo digital): sin márgenes propios. */
  readonly embedded = input(false);

  /** Filtros que aplica la página contenedora sobre el listado ya cargado. */
  readonly filter = input<CatalogFilter>(NO_CATALOG_FILTER);
  readonly sort = input<ProductSort>('name');

  readonly hasFilters = computed(() => {
    const filter = this.filter() ?? NO_CATALOG_FILTER;

    return this.categoryId() != null || !!filter.categoryIds || !!filter.brandNames || !!filter.priceRange;
  });

  readonly cards = computed(() =>
    sortCatalog(filterCatalog(this.items(), this.filter() ?? NO_CATALOG_FILTER), this.sort() ?? 'name').map(item => ({
      ...toProductCard(item),
      isFavorite: this.favorites().has(item.id)
    }))
  );

  /** Productos por página: 4 filas completas en escritorio (5 columnas). */
  readonly pageSize = 20;

  /** Vuelve a la primera página cuando cambian los productos, los filtros o el orden. */
  readonly page = linkedSignal(() => {
    this.items();
    this.filter();
    this.sort();

    return 1;
  });

  readonly pagedCards = computed(() => {
    const start = (this.page() - 1) * this.pageSize;

    return this.cards().slice(start, start + this.pageSize);
  });

  goToPage(page: number): void {
    this.page.set(page);
    // Al cambiar de página se vuelve al inicio del listado, no al pie.
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  constructor() {
    // El listado se pide solo en el navegador: así el servidor responde de
    // inmediato con el loader en vez de dejar la página en blanco mientras consulta.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }

    // Cada búsqueda nueva cancela la anterior para que no lleguen resultados viejos.
    combineLatest([
      inject(ActivatedRoute).queryParamMap.pipe(
        map(params => (params.get('q') ?? '').trim()),
        distinctUntilChanged()
      ),
      toObservable(this.categoryId)
    ]).pipe(
        tap(([term]) => {
          this.searchTerm.set(term);
          this.loading.set(true);
        }),
        switchMap(([term, categoryId]) =>
          this.catalogService.getProducts({ search: term || null, categoryId }).pipe(
            catchError(() => of([]))
          )
        ),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe(products => {
        this.items.set(products);
        this.loading.set(false);
      });
  }

  /** La tarjeta no conoce rutas: la página le indica a dónde lleva el producto. */
  detailLink(reference: string): unknown[] {
    return ['/catalogo', reference];
  }

  /** Solo llegan productos sin tonos y con existencias: la tarjeta ya lo verificó. */
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

    this.messageService.add({
      severity: 'success',
      summary: 'Agregado a tu pedido',
      detail: product.name + ' ya está en Mi pedido.'
    });
  }

  /** Nunca se elige un tono por el cliente: se elige en la ficha del producto. */
  onChooseVariant(product: ProductCardModel): void {
    this.router.navigate(this.detailLink(product.reference));
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
