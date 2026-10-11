import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, finalize, of, switchMap, timer } from 'rxjs';
import { ConfirmationService, MessageService, PrimeTemplate } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule, TablePageEvent } from 'primeng/table';

import { ProductService } from '../../../../core/services/product.service';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { Category } from '../../../../shared/models/category.model';
import { ProductListItem } from '../../../../shared/models/product.model';

/**
 * Productos que aún no pertenecen a ninguna categoría, con asignación masiva a la
 * categoría seleccionada en el árbol. Usa el toast y el diálogo de confirmación
 * de la pantalla que lo contiene.
 */
@Component({
  selector: 'app-uncategorized-products',
  imports: [
    FormsModule,
    TableModule,
    PrimeTemplate,
    ButtonModule,
    InputTextModule,
    LoaderComponent,
  ],
  templateUrl: './uncategorized-products.component.html',
  styleUrl: './uncategorized-products.component.scss',
})
export class UncategorizedProductsComponent {
  private readonly productService = inject(ProductService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  /** Categoría seleccionada en el árbol; es la que se asigna. */
  readonly category = input<Category | undefined>();
  /** Nombres desde la raíz hasta la categoría seleccionada, para mostrar la rama. */
  readonly categoryPath = input<string[]>([]);

  private readonly loadRequests = new Subject<number>();

  readonly products = signal<ProductListItem[]>([]);
  readonly selected = signal<ProductListItem[]>([]);
  readonly loading = signal(false);
  readonly assigning = signal(false);
  readonly search = signal('');

  /** Paginación en cliente: solo cambia lo que se ve, nunca la selección. */
  readonly pageSizes = [10, 25, 50];
  readonly first = signal(0);
  readonly pageSize = signal(this.pageSizes[0]);

  constructor() {
    this.loadRequests
      .pipe(
        switchMap((delay) => {
          this.loading.set(true);
          return (delay ? timer(delay) : of(0)).pipe(
            switchMap(() =>
              this.productService.getAll({
                search: this.search().trim() || null,
                hasCategories: false,
              }),
            ),
            catchError((error) => {
              this.showError('No se pudieron cargar los productos sin categoría', error);
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((products) => {
        this.products.set(products);
        // Solo se asigna lo que está a la vista: lo que la búsqueda oculta se desmarca.
        const selectedIds = new Set(this.selected().map((product) => product.id));
        this.selected.set(products.filter((product) => selectedIds.has(product.id)));
        // Si la página actual quedó vacía (p. ej. tras asignar), se retrocede a la última.
        if (this.first() >= products.length) {
          this.first.set(this.lastPageStart(products.length));
        }
      });

    this.load();
  }

  load(): void {
    this.loadRequests.next(0);
  }

  searchChanged(value: string): void {
    const previous = this.search().trim();
    this.search.set(value);
    if (value.trim() !== previous) {
      this.first.set(0);
      this.loadRequests.next(350);
    }
  }

  pageChanged(event: TablePageEvent): void {
    this.first.set(event.first);
    this.pageSize.set(event.rows);
  }

  clearSelection(): void {
    this.selected.set([]);
  }

  selectAll(): void {
    this.selected.set([...this.products()]);
  }

  confirmAssign(): void {
    if (this.assigning()) return;
    const products = this.selected();
    const category = this.category();

    if (products.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Selecciona productos',
        detail: 'Marca al menos un producto para agregarle una categoría.',
      });
      return;
    }

    if (!category) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Selecciona una categoría',
        detail: 'Elige en el árbol la categoría que quieres asignar.',
      });
      return;
    }

    const productIds = products.map((product) => product.id);

    this.confirmationService.confirm({
      header: 'Agregar categoría',
      message:
        'Los productos seleccionados se actualizarán con la siguiente categoría:' +
        '<span class="confirm-category-path">' +
        this.categoryBranch(category)
          .map((name) => this.escapeHtml(name))
          .join(' › ') +
        '</span>',
      icon: 'pi pi-tag',
      acceptLabel: 'Confirmar',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.assign(category, productIds),
    });
  }

  private assign(category: Category, productIds: number[]): void {
    this.assigning.set(true);

    this.productService
      .assignCategory(category.id, productIds)
      .pipe(finalize(() => this.assigning.set(false)))
      .subscribe({
        next: ({ updatedCount }) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Categoría agregada',
            detail:
              (updatedCount === 1
                ? 'Se actualizó 1 producto'
                : 'Se actualizaron ' + updatedCount + ' productos') +
              ' con la categoría "' +
              category.name +
              '".',
          });

          this.selected.set([]);
          this.load();
        },
        error: (error) => this.showError('No se pudo agregar la categoría', error),
      });
  }

  private lastPageStart(total: number): number {
    const size = this.pageSize();

    return total > 0 ? Math.floor((total - 1) / size) * size : 0;
  }

  /** Rama completa de la categoría; si no llegó, al menos su nombre. */
  private categoryBranch(category: Category): string[] {
    const path = this.categoryPath();

    return path.length > 0 ? path : [category.name];
  }

  /** El diálogo de confirmación pinta el mensaje como HTML. */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private showError(summary: string, error: unknown): void {
    const httpError = error as HttpErrorResponse;
    const detail = httpError?.error?.error ?? 'Ocurrió un error inesperado.';

    this.messageService.add({ severity: 'error', summary, detail, life: 6000 });
  }
}
