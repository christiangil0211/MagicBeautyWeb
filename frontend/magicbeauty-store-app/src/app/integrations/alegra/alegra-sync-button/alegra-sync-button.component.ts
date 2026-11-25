import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { AlegraService, AlegraSyncIssueKind, AlegraSyncResult } from '../alegra.service';

type Step = 'confirm' | 'running' | 'result' | 'error';

/**
 * Botón "Actualizar desde Alegra" con su propio diálogo (confirmación, progreso y
 * resumen). Solo aparece si el API dice que la integración está activa, y no
 * depende de nada de la pantalla que lo contiene salvo el evento `synced`.
 */
@Component({
  selector: 'app-alegra-sync-button',
  imports: [ButtonModule, DialogModule, LoaderComponent],
  templateUrl: './alegra-sync-button.component.html',
  styleUrl: './alegra-sync-button.component.scss',
})
export class AlegraSyncButtonComponent {
  private readonly alegra = inject(AlegraService);
  private readonly destroyRef = inject(DestroyRef);

  /** Terminó una actualización con cambios: la pantalla debe recargar su lista. */
  readonly synced = output<AlegraSyncResult>();

  readonly enabled = signal(false);
  readonly open = signal(false);
  readonly step = signal<Step>('confirm');
  readonly result = signal<AlegraSyncResult | null>(null);
  readonly errorMessage = signal('');

  readonly issueLabels: Record<AlegraSyncIssueKind, string> = {
    error: 'Error',
    skipped: 'Omitido',
    warning: 'Aviso',
  };

  constructor() {
    this.alegra
      .isEnabled()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.enabled.set(enabled));
  }

  openDialog(): void {
    this.step.set('confirm');
    this.result.set(null);
    this.errorMessage.set('');
    this.open.set(true);
  }

  close(): void {
    // Mientras corre no se cierra: el resultado se perdería de vista.
    if (this.step() !== 'running') this.open.set(false);
  }

  run(): void {
    if (this.step() === 'running') return;
    this.step.set('running');

    this.alegra
      .syncProducts()
      .pipe(
        finalize(() => {
          if (this.step() === 'running') this.step.set('error');
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.step.set('result');
          if (result.created + result.updated > 0) this.synced.emit(result);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            error?.error?.error ?? 'No se pudo completar la actualización desde Alegra.',
          );
          this.step.set('error');
        },
      });
  }
}
