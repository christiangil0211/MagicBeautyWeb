import { Component, computed, input, output } from '@angular/core';

/**
 * Paginación de MagicCuadre: botones cuadrados de 36px con borde rosado y la
 * página actual en fucsia. No conoce el origen de los datos: recibe totales y
 * emite la página elegida (base 1).
 */
@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss'
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  /** Cuántos números se muestran alrededor de la página actual. */
  readonly siblings = input(1);

  readonly pageChange = output<number>();

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly rangeLabel = computed(() => {
    if (this.total() === 0) {
      return 'Sin resultados';
    }

    const from = (this.page() - 1) * this.pageSize() + 1;
    const to = Math.min(this.page() * this.pageSize(), this.total());

    return `${from}–${to} de ${this.total()}`;
  });

  /** Números de página con elipsis: 1 … 4 5 6 … 20. */
  readonly items = computed<(number | null)[]>(() => {
    const count = this.pageCount();
    const current = this.page();
    const siblings = this.siblings();
    const start = Math.max(2, current - siblings);
    const end = Math.min(count - 1, current + siblings);
    const pages: (number | null)[] = [1];

    if (start > 2) {
      pages.push(null);
    }

    for (let page = start; page <= end; page++) {
      pages.push(page);
    }

    if (end < count - 1) {
      pages.push(null);
    }

    if (count > 1) {
      pages.push(count);
    }

    return pages;
  });

  go(page: number): void {
    const target = Math.min(Math.max(1, page), this.pageCount());

    if (target !== this.page()) {
      this.pageChange.emit(target);
    }
  }
}
