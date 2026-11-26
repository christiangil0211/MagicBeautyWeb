import { HttpClient, HttpParams } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
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
  imports: [ButtonModule, DialogModule, DecimalPipe, FormsModule, InputTextModule, SelectModule, TableModule, TagModule, LoaderComponent, PageHeaderComponent, SalesImportComponent],
  templateUrl: './admin-sales.component.html',
  styleUrl: './admin-sales.component.scss'
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
  status: string | null = '';
  search = '';
  private filters = new HttpParams();

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
    this.from = this.through = this.search = '';
    this.status = null;
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
      error: response => {
        this.result.set(null);
        this.error.set(response.status === 404
          ? 'La API en ejecución todavía no incluye el listado de ventas.'
          : 'No se pudieron consultar las ventas. Vuelve a intentarlo.');
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

  statusSeverity(status: string): 'success' | 'info' | 'secondary' | 'danger' {
    if (status === 'Closed') return 'success';
    if (status === 'Open') return 'info';
    if (status === 'Voided') return 'danger';
    return 'secondary';
  }

  statusLabel(status: string): string {
    return this.states.find(state => state.value === status)?.label ?? status;
  }
}
