import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { EMPTY, catchError, exhaustMap, takeWhile, timer } from 'rxjs';

import { CustomerImportRun, CustomerImportService } from '../../../core/services/customer-import.service';

@Component({
  selector: 'app-customer-import',
  imports: [ButtonModule, DialogModule],
  templateUrl: './customer-import.component.html'
})
export class CustomerImportComponent {
  private readonly api = inject(CustomerImportService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly run = signal<CustomerImportRun | null>(null);
  readonly error = signal('');

  show(): void {
    this.open.set(true);
    this.error.set('');
    if (this.busy()) return;

    this.busy.set(true);
    this.api.latest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: current => {
        this.run.set(current);
        if (current && (current.status === 'Queued' || current.status === 'Running')) {
          this.watch(current.id);
        } else {
          this.busy.set(false);
        }
      },
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudo consultar el estado de la importación.');
      }
    });
  }

  start(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api.start().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ id }) => {
        this.run.set(null);
        this.watch(id);
      },
      error: (response: HttpErrorResponse) => {
        this.error.set(response.error?.message ?? 'No se pudo iniciar la importación de contactos.');
        this.busy.set(false);
      }
    });
  }

  private watch(id: string): void {
    timer(0, 5000).pipe(
      exhaustMap(() => this.api.get(id).pipe(catchError(() => {
        this.error.set('Se interrumpió la consulta de estado. Volveremos a consultar.');
        return EMPTY;
      }))),
      takeWhile(current => current.status === 'Queued' || current.status === 'Running', true),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(current => {
      this.run.set(current);
      this.error.set('');
      this.busy.set(current.status === 'Queued' || current.status === 'Running');
    });
  }
}
