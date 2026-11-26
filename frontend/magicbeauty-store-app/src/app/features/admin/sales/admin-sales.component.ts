import { HttpClient, HttpParams } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Subscription } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SalesImportComponent } from './sales-import.component';

interface SaleRow {
  id: number;
  externalId: string;
  saleDate: string;
  status: string;
  units: number;
  lineCount: number;
}

interface SalePage {
  items: SaleRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface SaleLine {
  id: number;
  name: string | null;
  reference: string | null;
  externalItemId: string;
  quantity: number;
  productId: number | null;
}

@Component({
  selector: 'app-admin-sales',
  imports: [ButtonModule, DecimalPipe, FormsModule, PageHeaderComponent, SalesImportComponent],
  templateUrl: './admin-sales.component.html',
  styles: [`
    form { display: flex; flex-wrap: wrap; align-items: end; gap: 1rem; margin-block: 1.5rem; }
    label { display: grid; gap: .35rem; }
    input, select { font: inherit; padding: .45rem; border: 1px solid #a5a5a5; border-radius: .35rem; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: .65rem; border-bottom: 1px solid #ddd; }
    .pagination { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; margin-block: 1rem; }
  `]
})
export class AdminSalesComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly url = `${environment.apiBaseUrl}/admin/sales`;
  private listRequest?: Subscription;
  private detailRequest?: Subscription;

  readonly states = [
    { value: 'Open', label: 'Abierta' }, { value: 'Closed', label: 'Cerrada' },
    { value: 'Draft', label: 'Borrador' }, { value: 'Voided', label: 'Anulada' },
    { value: 'Unknown', label: 'Desconocido' }
  ];
  readonly result = signal<SalePage | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly selected = signal<SaleRow | null>(null);
  readonly lines = signal<SaleLine[] | null>(null);
  readonly detailError = signal('');
  from = '';
  through = '';
  status = '';
  search = '';
  private filters = new HttpParams();

  constructor() {
    this.load(1);
  }

  apply(): void {
    this.filters = new HttpParams();
    for (const [name, value] of Object.entries({
      from: this.from, through: this.through, status: this.status, search: this.search.trim()
    })) {
      if (value) this.filters = this.filters.set(name, value);
    }
    this.load(1);
  }

  clear(): void {
    this.from = this.through = this.status = this.search = '';
    this.apply();
  }

  load(page: number): void {
    this.listRequest?.unsubscribe();
    this.closeDetail();
    this.loading.set(true);
    this.error.set('');
    this.listRequest = this.http.get<SalePage>(this.url, {
      params: this.filters.set('page', page), transferCache: false
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.result.set(null);
        this.error.set('No se pudieron consultar las ventas. Revisa los filtros o vuelve a intentarlo.');
        this.loading.set(false);
      }
    });
  }

  openDetail(row: SaleRow): void {
    this.closeDetail();
    this.selected.set(row);
    this.detailRequest = this.http.get<{ lines: SaleLine[] }>(`${this.url}/${row.id}`, {
      transferCache: false
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => this.lines.set(response.lines),
      error: () => this.detailError.set('No se pudo consultar el detalle.')
    });
  }

  closeDetail(): void {
    this.detailRequest?.unsubscribe();
    this.selected.set(null);
    this.lines.set(null);
    this.detailError.set('');
  }

  statusLabel(status: string): string {
    return this.states.find(state => state.value === status)?.label ?? status;
  }
}
