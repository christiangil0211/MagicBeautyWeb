import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, combineLatest, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { ToastModule } from 'primeng/toast';

import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { ProductCardModel, toProductCard } from '../../../shared/models/product.model';

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

  /** Las pistas de administración solo se muestran a quien puede administrar. */
  readonly canManageStore = inject(AuthService).canManageStore;

  readonly products = signal<ProductCardModel[]>([]);
  readonly loading = signal(true);
  readonly favorites = signal<Set<number>>(new Set());

  readonly cards = computed(() =>
    this.products().map(product => ({
      ...product,
      isFavorite: this.favorites().has(product.id)
    }))
  );

  /** Productos por página: 4 filas completas en escritorio (5 columnas). */
  readonly pageSize = 20;
  readonly page = signal(1);

  readonly pagedCards = computed(() => {
    const start = (this.page() - 1) * this.pageSize;

    return this.cards().slice(start, start + this.pageSize);
  });

  goToPage(page: number): void {
    this.page.set(page);
    // Al cambiar de página se vuelve al inicio del listado, no al pie.
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  /** Texto buscado desde la cabecera (?q=). Vacío muestra todo el catálogo. */
  readonly searchTerm = signal('');
  readonly categoryId = input<number | null>(null);
  readonly hideHeading = input(false);

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
          this.page.set(1);
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
        this.products.set(products.map(toProductCard));
        this.loading.set(false);
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
