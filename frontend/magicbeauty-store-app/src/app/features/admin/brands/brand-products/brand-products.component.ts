import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService, PrimeTemplate } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule, TablePageEvent } from 'primeng/table';
import { EMPTY, Subject, catchError, finalize, of, switchMap, timer } from 'rxjs';

import { BrandService } from '../../../../core/services/brand.service';
import { Brand, BrandAssignmentConflict, BrandProductItem, BrandProductScope } from '../../../../shared/models/brand.model';

/**
 * Productos de la marca seleccionada. Un producto tiene UNA marca: agregarlo a
 * esta marca reemplaza la que tenía (pidiendo confirmación) y quitarlo lo deja sin
 * marca. La lista se pagina en el servidor; la selección vale para la página actual.
 * Usa el toast y el diálogo de confirmación de la pantalla que lo contiene.
 */
@Component({
  selector: 'app-brand-products',
  imports: [FormsModule, TableModule, PrimeTemplate, ButtonModule, InputTextModule, SelectButtonModule],
  templateUrl: './brand-products.component.html',
  styleUrl: './brand-products.component.scss'
})
export class BrandProductsComponent {
  private readonly brandService = inject(BrandService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly brand = input<Brand | null>(null);
  /** Se asignaron o quitaron productos: cambian los conteos. */
  readonly changed = output<void>();

  readonly scopeOptions: { label: string; value: BrandProductScope }[] = [
    { label: 'Sin marca', value: 'without-brand' },
    { label: 'De esta marca', value: 'in-brand' },
    { label: 'Todos', value: 'all' }
  ];

  readonly scope = signal<BrandProductScope>('without-brand');
  readonly search = signal('');
  readonly products = signal<BrandProductItem[]>([]);
  readonly total = signal(0);
  readonly first = signal(0);
  readonly pageSizes = [10, 25, 50];
  readonly pageSize = signal(25);
  readonly selected = signal<BrandProductItem[]>([]);
  readonly loading = signal(false);
  readonly working = signal(false);

  /** Seleccionados que todavía no son de esta marca (se agregarían). */
  readonly toAssign = computed(() => this.selected().filter(product => product.brandId !== this.brand()?.id));
  /** Seleccionados que son de esta marca (se quitarían). */
  readonly toRemove = computed(() => this.selected().filter(product => product.brandId === this.brand()?.id));

  private readonly loadRequests = new Subject<number>();

  constructor() {
    this.loadRequests
      .pipe(
        switchMap(delay => {
          const brand = this.brand();
          if (!brand) {
            this.products.set([]);
            this.total.set(0);
            return EMPTY;
          }

          this.loading.set(true);
          const page = Math.floor(this.first() / this.pageSize()) + 1;
          return (delay ? timer(delay) : of(0)).pipe(
            switchMap(() => this.brandService.getProducts(brand.id, this.scope(), this.search(), page, this.pageSize())),
            catchError(error => {
              this.showError('No se pudieron cargar los productos', error);
              return EMPTY;
            }),
            finalize(() => this.loading.set(false))
          );
        }),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe(result => {
        this.products.set(result.items);
        this.total.set(result.total);
        this.selected.set([]);
      });

    // Al cambiar de marca se vuelve a la primera página.
    effect(() => {
      this.brand()?.id;
      untracked(() => {
        this.first.set(0);
        this.load();
      });
    });
  }

  load(delay = 0): void {
    this.loadRequests.next(delay);
  }

  scopeChanged(value: BrandProductScope | null): void {
    if (!value || value === this.scope()) return;
    this.scope.set(value);
    this.first.set(0);
    this.load();
  }

  searchChanged(value: string): void {
    this.search.set(value);
    this.first.set(0);
    this.load(350);
  }

  pageChanged(event: TablePageEvent): void {
    this.first.set(event.first);
    this.pageSize.set(event.rows);
    this.load();
  }

  isInBrand(product: BrandProductItem): boolean {
    return product.brandId != null && product.brandId === this.brand()?.id;
  }

  assignSelected(): void {
    const brand = this.brand();
    const products = this.toAssign();
    if (!brand || products.length === 0 || this.working()) return;

    this.assign(brand, products.map(product => product.id), false);
  }

  removeSelected(): void {
    const brand = this.brand();
    const products = this.toRemove();
    if (!brand || products.length === 0 || this.working()) return;

    this.confirmationService.confirm({
      header: 'Quitar de la marca',
      message: `${this.count(products.length)} quedará${products.length === 1 ? '' : 'n'} sin marca. Podrás asignarle${products.length === 1 ? '' : 's'} otra después.`,
      icon: 'pi pi-minus-circle',
      acceptLabel: 'Quitar',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.working.set(true);
        this.brandService
          .removeProducts(products.map(product => product.id))
          .pipe(finalize(() => this.working.set(false)))
          .subscribe({
            next: ({ updatedCount }) => this.done(`${this.count(updatedCount)} sin marca.`),
            error: error => this.showError('No se pudieron quitar los productos', error)
          });
      }
    });
  }

  /**
   * Primero sin mover nada: si algún producto ya es de otra marca, el API responde
   * 409 con la lista y se pide confirmar ("Este producto es de X, se moverá a Y").
   */
  private assign(brand: Brand, productIds: number[], moveFromOtherBrands: boolean): void {
    this.working.set(true);
    this.brandService
      .assignProducts(brand.id, productIds, moveFromOtherBrands)
      .pipe(finalize(() => this.working.set(false)))
      .subscribe({
        next: ({ updatedCount }) => this.done(`${this.count(updatedCount)} con la marca "${brand.name}".`),
        error: error => {
          const conflicts = error instanceof HttpErrorResponse && error.status === 409 ? (error.error?.conflicts as BrandAssignmentConflict[] | undefined) : undefined;
          if (conflicts?.length) {
            this.confirmMove(brand, productIds, conflicts);
          } else {
            this.showError('No se pudo asignar la marca', error);
          }
        }
      });
  }

  private confirmMove(brand: Brand, productIds: number[], conflicts: BrandAssignmentConflict[]): void {
    const items = conflicts
      .slice(0, 8)
      .map(conflict => `<li><strong>${this.escape(conflict.reference)}</strong> ${this.escape(conflict.name)}: es de ${this.escape(conflict.currentBrandName)}, se moverá a ${this.escape(brand.name)}.</li>`)
      .join('');
    const more = conflicts.length > 8 ? `<li>Y ${conflicts.length - 8} más.</li>` : '';

    this.confirmationService.confirm({
      header: 'Mover de marca',
      message: `<p>Un producto tiene una sola marca. Estos productos cambiarán de marca:</p><ul class="move-list">${items}${more}</ul>`,
      icon: 'pi pi-arrow-right-arrow-left',
      acceptLabel: 'Mover y asignar',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.assign(brand, productIds, true)
    });
  }

  private done(detail: string): void {
    this.messageService.add({ severity: 'success', summary: 'Listo', detail });
    this.selected.set([]);
    this.load();
    this.changed.emit();
  }

  private count(value: number): string {
    return value === 1 ? '1 producto' : `${value} productos`;
  }

  private escape(text: string): string {
    return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  }

  private showError(summary: string, error: unknown): void {
    const detail =
      error instanceof HttpErrorResponse && typeof error.error?.error === 'string' ? error.error.error : 'Intenta de nuevo en unos segundos.';
    this.messageService.add({ severity: 'error', summary, detail });
  }
}
