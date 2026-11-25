import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, finalize, of, switchMap, timer } from 'rxjs';
import { ConfirmationService, MessageService, PrimeTemplate } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { ProductService } from '../../../../core/services/product.service';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { Category } from '../../../../shared/models/category.model';
import { ProductCategoryLink, ProductListItem } from '../../../../shared/models/product.model';

/** Qué productos lista la tabla: todos o solo los que no tienen ninguna categoría. */
export type ProductScope = 'all' | 'uncategorized';

/** Chips de categoría visibles por fila; el resto se resume en "+N" con tooltip. */
const VISIBLE_CATEGORY_CHIPS = 3;

/**
 * Asignación masiva de la categoría seleccionada en el árbol. Un producto puede
 * tener N categorías, así que se listan todos (con el filtro "Sin categoría" como
 * atajo) y cada fila muestra las categorías que ya tiene. Los productos que ya
 * pertenecen a la categoría seleccionada se marcan y no se pueden seleccionar.
 * Usa el toast y el diálogo de confirmación de la pantalla que lo contiene.
 */
@Component({
  selector: 'app-category-product-assignment',
  imports: [
    FormsModule,
    TableModule,
    PrimeTemplate,
    ButtonModule,
    InputTextModule,
    SelectButtonModule,
    TooltipModule,
    LoaderComponent,
  ],
  templateUrl: './category-product-assignment.component.html',
  styleUrl: './category-product-assignment.component.scss',
})
export class CategoryProductAssignmentComponent {
  private readonly productService = inject(ProductService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  /** Categoría seleccionada en el árbol; es la que se asigna. */
  readonly category = input<Category | undefined>();
  /** Nombres desde la raíz hasta la categoría seleccionada, para mostrar la rama. */
  readonly categoryPath = input<string[]>([]);

  private readonly loadRequests = new Subject<number>();

  readonly scopeOptions: { label: string; value: ProductScope }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Sin categoría', value: 'uncategorized' },
  ];

  readonly products = signal<ProductListItem[]>([]);
  readonly selected = signal<ProductListItem[]>([]);
  readonly loading = signal(false);
  readonly assigning = signal(false);
  readonly search = signal('');
  readonly scope = signal<ProductScope>('all');

  /** Ids de los productos listados que ya pertenecen a la categoría seleccionada. */
  readonly assignedIds = computed(() => {
    const categoryId = this.category()?.id;
    if (categoryId == null) return new Set<number>();

    return new Set(
      this.products()
        .filter((product) => this.hasCategory(product, categoryId))
        .map((product) => product.id),
    );
  });

  /** Productos que todavía pueden recibir la categoría seleccionada. */
  readonly assignable = computed(() => {
    const assigned = this.assignedIds();
    return this.products().filter((product) => !assigned.has(product.id));
  });

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
                // Sin filtro se traen todos: un producto con categorías puede recibir más.
                hasCategories: this.scope() === 'uncategorized' ? false : null,
              }),
            ),
            catchError((error) => {
              this.showError('No se pudieron cargar los productos', error);
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((products) => {
        this.products.set(products);
        // Solo se asigna lo que está a la vista y aún no tiene la categoría.
        this.keepAssignableSelection();
        // Si la página actual quedó vacía (p. ej. tras asignar), se retrocede a la última.
        if (this.first() >= products.length) {
          this.first.set(this.lastPageStart(products.length));
        }
      });

    // Al cambiar de categoría en el árbol se desmarcan los productos que ya la tienen.
    effect(() => {
      this.assignedIds();
      untracked(() => this.keepAssignableSelection());
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

  scopeChanged(value: ProductScope | null): void {
    // El selector no permite quedar vacío, pero se protege igual.
    if (!value || value === this.scope()) return;
    this.scope.set(value);
    this.first.set(0);
    this.load();
  }

  pageChanged(event: TablePageEvent): void {
    this.first.set(event.first);
    this.pageSize.set(event.rows);
  }

  clearSelection(): void {
    this.selected.set([]);
  }

  selectAll(): void {
    this.selected.set([...this.assignable()]);
  }

  isAssigned(product: ProductListItem): boolean {
    return this.assignedIds().has(product.id);
  }

  /** Chips visibles: primero la categoría seleccionada (si la tiene), luego el resto. */
  visibleCategories(product: ProductListItem): ProductCategoryLink[] {
    return this.orderedCategories(product).slice(0, VISIBLE_CATEGORY_CHIPS);
  }

  hiddenCategories(product: ProductListItem): ProductCategoryLink[] {
    return this.orderedCategories(product).slice(VISIBLE_CATEGORY_CHIPS);
  }

  hiddenCategoriesTooltip(product: ProductListItem): string {
    return this.hiddenCategories(product)
      .map((link) => link.name)
      .join(', ');
  }

  isCurrentCategory(link: ProductCategoryLink): boolean {
    return link.categoryId === this.category()?.id;
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
        '</span>' +
        '<span class="confirm-category-note">Las categorías que ya tienen se conservan.</span>',
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

  private keepAssignableSelection(): void {
    const current = this.selected();
    const selectedIds = new Set(current.map((product) => product.id));
    // Se toman las filas actuales para que el checkbox de la tabla las reconozca.
    const kept = this.assignable().filter((product) => selectedIds.has(product.id));

    if (kept.length !== current.length || kept.some((product, index) => product !== current[index])) {
      this.selected.set(kept);
    }
  }

  private hasCategory(product: ProductListItem, categoryId: number): boolean {
    return (product.categoryLinks ?? []).some((link) => link.categoryId === categoryId);
  }

  private orderedCategories(product: ProductListItem): ProductCategoryLink[] {
    const links = product.categoryLinks ?? [];
    const currentId = this.category()?.id;
    if (currentId == null) return links;

    return [
      ...links.filter((link) => link.categoryId === currentId),
      ...links.filter((link) => link.categoryId !== currentId),
    ];
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
