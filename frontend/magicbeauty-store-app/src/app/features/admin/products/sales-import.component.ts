import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { Subscription, exhaustMap, timer } from 'rxjs';

import { SalesImportRun, SalesImportService } from '../../../core/services/sales-import.service';

@Component({
  selector: 'app-sales-import',
  imports: [ButtonModule, DatePipe, DecimalPipe],
  template: `
    <p-button label="Importar ventas" icon="pi pi-download" severity="secondary"
      [loading]="starting()" [disabled]="active()" (onClick)="start()" />
    @if (run()?.status === 'Failed') {
      <p-button label="Reanudar" severity="secondary" [disabled]="starting()" (onClick)="start(run()?.id)" />
    }
    <div aria-live="polite">
      @if (error(); as message) {
        <p>{{ message }}</p>
        <button type="button" (click)="refresh()">Consultar estado</button>
      }
      @if (run(); as current) {
        <p>{{ labels[current.status] }} · {{ current.pages }} páginas · {{ current.invoices }} facturas</p>
        @if (current.error) { <p>{{ current.error }}</p> }
        @if (current.lastSuccessAt) {
          <p>Última importación exitosa {{ current.lastSuccessAt | date:'medium' }}</p>
        }
        @if (current.unlinkedPercent !== null) {
          <details>
            <summary>{{ current.unlinkedPercent | number:'1.0-2' }} % de unidades sin vínculo</summary>
            <ul>
              @for (item of current.unlinked; track item.externalItemId) {
                <li>{{ item.externalItemId }} · {{ item.units | number }} unidades</li>
              }
            </ul>
          </details>
        }
      }
    </div>
  `
})
export class SalesImportComponent {
  private readonly api = inject(SalesImportService);
  private readonly destroyRef = inject(DestroyRef);
  private polling?: Subscription;

  readonly run = signal<SalesImportRun | null>(null);
  readonly starting = signal(false);
  readonly error = signal('');
  readonly active = computed(() => {
    const status = this.run()?.status;
    return status === 'Queued' || status === 'Running' || (this.pollingId() !== null && !status);
  });
  private readonly pollingId = signal<string | null>(null);
  readonly labels = { Queued: 'En espera', Running: 'En curso', Succeeded: 'Completada', Failed: 'Fallida' };

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.api.latest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: current => {
        this.error.set('');
        this.run.set(current);
        if (current?.status === 'Queued' || current?.status === 'Running') this.watch(current.id);
      },
      error: () => this.error.set('No se pudo consultar el estado de la importación.')
    });
  }

  start(resumeId?: string): void {
    if (this.starting() || this.active()) return;
    this.starting.set(true);
    this.error.set('');
    this.api.start(resumeId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ id }) => {
        this.run.set(null);
        this.watch(id);
        this.starting.set(false);
      },
      error: (response: HttpErrorResponse) => {
        this.starting.set(false);
        if (response.status === 409 && typeof response.error?.id === 'string') {
          this.run.set(null);
          this.watch(response.error.id);
          return;
        }
        this.error.set(response.error?.message ?? 'No se pudo iniciar la importación.');
      }
    });
  }

  private watch(id: string): void {
    this.polling?.unsubscribe();
    this.pollingId.set(id);
    this.polling = timer(0, 4000).pipe(
      exhaustMap(() => this.api.get(id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: current => {
        this.run.set(current);
        if (current.status === 'Succeeded' || current.status === 'Failed') {
          this.pollingId.set(null);
          this.polling?.unsubscribe();
        }
      },
      error: () => {
        this.pollingId.set(null);
        this.error.set('No se pudo actualizar el estado de la importación.');
      }
    });
  }
}
