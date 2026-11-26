import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { EMPTY, Subscription, catchError, exhaustMap, timer } from 'rxjs';

import { SalesImportRun, SalesImportService } from '../../../core/services/sales-import.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';

@Component({
  selector: 'app-sales-import',
  imports: [ButtonModule, DatePipe, DecimalPipe, DialogModule, LoaderComponent],
  templateUrl: './sales-import.component.html',
  styleUrl: './sales-import.component.scss'
})
export class SalesImportComponent {
  private readonly api = inject(SalesImportService);
  private readonly destroyRef = inject(DestroyRef);
  private polling?: Subscription;

  readonly settled = output<void>();
  readonly run = signal<SalesImportRun | null>(null);
  readonly lastSuccess = signal<string | null>(null);
  readonly open = signal(false);
  readonly step = signal<'confirm' | 'running' | 'result' | 'error'>('confirm');
  readonly checking = signal(true);
  readonly error = signal('');
  readonly busy = computed(() => this.step() === 'running');

  ngOnInit(): void {
    this.api.latest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: current => {
        this.checking.set(false);
        this.run.set(current);
        this.lastSuccess.set(current?.lastSuccessAt ?? null);
        if (current?.status === 'Queued' || current?.status === 'Running') {
          this.open.set(true);
          this.watch(current.id);
        } else {
          this.settled.emit();
        }
      },
      error: () => {
        this.checking.set(false);
        this.settled.emit();
      }
    });
  }

  show(): void {
    if (this.busy()) return;
    this.error.set('');
    this.step.set(this.run()?.status === 'Failed' ? 'result' : 'confirm');
    this.open.set(true);
  }

  close(): void {
    if (!this.busy()) this.open.set(false);
  }

  start(resumeId?: string): void {
    if (this.busy()) return;
    this.step.set('running');
    this.error.set('');
    this.api.start(resumeId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ id }) => {
        this.run.set(null);
        this.watch(id);
      },
      error: (response: HttpErrorResponse) => {
        if (response.status === 409 && typeof response.error?.id === 'string') {
          this.run.set(null);
          this.watch(response.error.id);
          return;
        }
        this.step.set('error');
        this.error.set(response.error?.message ?? 'No se pudo iniciar la importación.');
      }
    });
  }

  private watch(id: string): void {
    this.step.set('running');
    this.polling?.unsubscribe();
    this.polling = timer(0, 5000).pipe(
      exhaustMap(() => this.api.get(id).pipe(catchError(() => {
        this.error.set('Se interrumpió la consulta de estado. Seguiremos consultando la importación.');
        return EMPTY;
      }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(current => {
      this.run.set(current);
      this.error.set('');
      if (current.status === 'Succeeded' || current.status === 'Failed') {
        this.polling?.unsubscribe();
        this.lastSuccess.set(current.lastSuccessAt);
        this.step.set('result');
        this.settled.emit();
      }
    });
  }
}
