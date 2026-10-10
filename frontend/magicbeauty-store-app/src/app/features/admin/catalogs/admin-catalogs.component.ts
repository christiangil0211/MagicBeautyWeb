import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { firstValueFrom } from 'rxjs';

import { TraditionalCatalogService } from '../../../core/services/traditional-catalog.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { TraditionalCatalog, TraditionalCatalogFile } from '../../../shared/models/traditional-catalog.model';

/** Mismos límites que valida el API (ImageUploadRules y PdfUploadRules). */
const FILE_RULES: Record<TraditionalCatalogFile, { maxBytes: number; accept: string; label: string; hint: string }> = {
  cover: {
    maxBytes: 8 * 1024 * 1024,
    accept: 'image/jpeg,image/png,image/webp,image/gif',
    label: 'Portada',
    hint: 'JPG, PNG, WEBP o GIF. Máximo 8 MB. Ideal en formato vertical.'
  },
  pdf: {
    maxBytes: 50 * 1024 * 1024,
    accept: 'application/pdf',
    label: 'PDF descargable',
    hint: 'Exportado desde Canva. Máximo 50 MB.'
  }
};

/**
 * Administración de los catálogos tradicionales (Canva + PDF). Sigue el patrón
 * de categorías: los datos se guardan primero y los archivos pendientes se
 * suben después, con el mismo endpoint y reglas que valida el API.
 */
@Component({
  selector: 'app-admin-catalogs',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    ToggleSwitchModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    PageHeaderComponent,
    LoaderComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-catalogs.component.html',
  styleUrl: './admin-catalogs.component.scss'
})
export class AdminCatalogsComponent {
  private readonly catalogService = inject(TraditionalCatalogService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly fileKinds = (Object.keys(FILE_RULES) as TraditionalCatalogFile[]).map(kind => ({ kind, ...FILE_RULES[kind] }));

  readonly catalogs = signal<TraditionalCatalog[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly selectedId = signal<number | null>(null);

  readonly pendingFiles = signal<Partial<Record<TraditionalCatalogFile, File>>>({});
  readonly pendingRemovals = signal<TraditionalCatalogFile[]>([]);

  readonly selectedCatalog = computed(() => this.catalogs().find(catalog => catalog.id === this.selectedId()) ?? null);
  readonly activeCount = computed(() => this.catalogs().filter(catalog => catalog.isActive).length);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    canvaUrl: ['', [Validators.required, Validators.maxLength(4000)]],
    displayOrder: [10, [Validators.required, Validators.min(0)]],
    isActive: [true]
  });

  constructor() {
    this.load();
  }

  load(selectAfterLoad?: number): void {
    this.loading.set(true);

    this.catalogService.getAll().subscribe({
      next: catalogs => {
        this.catalogs.set(catalogs);
        this.loading.set(false);

        if (selectAfterLoad !== undefined) {
          const catalog = catalogs.find(item => item.id === selectAfterLoad);

          if (catalog) {
            this.select(catalog);
          }
        }
      },
      error: error => {
        this.loading.set(false);
        this.showError('No se pudieron cargar los catálogos', error);
      }
    });
  }

  newCatalog(): void {
    if (this.saving()) return;

    this.selectedId.set(null);
    this.pendingFiles.set({});
    this.pendingRemovals.set([]);
    this.form.reset({
      name: '',
      canvaUrl: '',
      displayOrder: this.nextDisplayOrder(),
      isActive: true
    });
  }

  select(catalog: TraditionalCatalog): void {
    if (this.saving()) return;

    this.selectedId.set(catalog.id);
    this.pendingFiles.set({});
    this.pendingRemovals.set([]);
    this.form.reset({
      name: catalog.name,
      canvaUrl: catalog.canvaShareUrl || catalog.canvaEmbedUrl,
      displayOrder: catalog.displayOrder,
      isActive: catalog.isActive
    });
  }

  currentFileUrl(kind: TraditionalCatalogFile): string | null {
    const catalog = this.selectedCatalog();

    if (!catalog || this.pendingRemovals().includes(kind)) {
      return null;
    }

    return (kind === 'cover' ? catalog.coverImageUrl : catalog.pdfUrl) ?? null;
  }

  selectFile(kind: TraditionalCatalogFile, event: Event): void {
    if (this.saving()) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const rule = FILE_RULES[kind];

    if (file && (file.size === 0 || file.size > rule.maxBytes)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Revisa el archivo',
        detail: `${rule.label}: selecciona un archivo de hasta ${rule.maxBytes / 1024 / 1024} MB que no esté vacío.`
      });
      input.value = '';
      return;
    }

    if (file) {
      this.pendingFiles.update(files => ({ ...files, [kind]: file }));
      this.pendingRemovals.update(kinds => kinds.filter(item => item !== kind));
    }
  }

  removeFile(kind: TraditionalCatalogFile): void {
    if (this.saving()) return;

    this.pendingFiles.update(files => {
      const next = { ...files };
      delete next[kind];
      return next;
    });

    if (this.selectedCatalog() && (kind === 'cover' ? this.selectedCatalog()!.coverImageUrl : this.selectedCatalog()!.pdfUrl)) {
      this.pendingRemovals.update(kinds => (kinds.includes(kind) ? kinds : [...kinds, kind]));
    }
  }

  async save(): Promise<void> {
    if (this.saving()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    let id = this.selectedId();

    try {
      const value = this.form.getRawValue();

      if (id === null) {
        const created = await firstValueFrom(this.catalogService.create(value));
        id = created.id;
        this.selectedId.set(id);
        this.catalogs.update(catalogs => [...catalogs, created]);
      } else {
        await firstValueFrom(this.catalogService.update(id, value));
      }

      for (const { kind } of this.fileKinds) {
        const file = this.pendingFiles()[kind];

        if (file) {
          await firstValueFrom(this.catalogService.uploadFile(id, kind, file));
          this.pendingFiles.update(files => {
            const next = { ...files };
            delete next[kind];
            return next;
          });
        } else if (this.pendingRemovals().includes(kind)) {
          await firstValueFrom(this.catalogService.deleteFile(id, kind));
          this.pendingRemovals.update(kinds => kinds.filter(item => item !== kind));
        }
      }

      this.messageService.add({ severity: 'success', summary: 'Listo', detail: 'Los cambios se guardaron.' });
      this.load(id);
    } catch (error) {
      this.showError('No se pudo completar el guardado; puedes reintentar los archivos pendientes', error);

      if (id !== null) {
        this.load(id);
      }
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(): void {
    const catalog = this.selectedCatalog();

    if (this.saving() || !catalog) return;

    this.confirmationService.confirm({
      header: 'Eliminar catálogo',
      message: 'Se eliminará "' + catalog.name + '" junto con su portada y su PDF. Esta acción no se puede deshacer.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.delete(catalog.id)
    });
  }

  /** Cambia el estado desde la lista sin tocar el resto del formulario. */
  toggleActive(catalog: TraditionalCatalog, event: Event): void {
    event.stopPropagation();

    if (this.saving()) return;

    this.saving.set(true);
    this.catalogService
      .update(catalog.id, {
        name: catalog.name,
        canvaUrl: catalog.canvaShareUrl || catalog.canvaEmbedUrl,
        displayOrder: catalog.displayOrder,
        isActive: !catalog.isActive
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.load(this.selectedId() ?? undefined);
        },
        error: error => {
          this.saving.set(false);
          this.showError('No se pudo cambiar el estado', error);
        }
      });
  }

  /**
   * Sube o baja un puesto. Se renumera la lista de 10 en 10 (como al crear) y solo
   * se guardan los que cambian: así funciona aunque dos compartan número de orden.
   */
  async move(catalog: TraditionalCatalog, direction: -1 | 1, event: Event): Promise<void> {
    event.stopPropagation();

    const list = [...this.catalogs()];
    const index = list.findIndex(item => item.id === catalog.id);
    const target = index + direction;

    if (this.saving() || index < 0 || target < 0 || target >= list.length) return;

    [list[index], list[target]] = [list[target], list[index]];

    const changes = list
      .map((item, position) => ({ item, displayOrder: (position + 1) * 10 }))
      .filter(({ item, displayOrder }) => item.displayOrder !== displayOrder);

    this.saving.set(true);

    try {
      for (const { item, displayOrder } of changes) {
        await firstValueFrom(this.catalogService.update(item.id, this.toRequest(item, displayOrder)));
      }
    } catch (error) {
      this.showError('No se pudo cambiar el orden', error);
    } finally {
      this.saving.set(false);
      this.load(this.selectedId() ?? undefined);
    }
  }

  fileName(kind: TraditionalCatalogFile): string | null {
    return this.pendingFiles()[kind]?.name ?? null;
  }

  private toRequest(catalog: TraditionalCatalog, displayOrder: number) {
    return { name: catalog.name, canvaUrl: catalog.canvaShareUrl || catalog.canvaEmbedUrl, displayOrder, isActive: catalog.isActive };
  }

  private delete(id: number): void {
    this.catalogService.delete(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Catálogo eliminado',
          detail: 'El catálogo y sus archivos se quitaron.'
        });
        this.newCatalog();
        this.load();
      },
      error: error => this.showError('No se pudo eliminar', error)
    });
  }

  private nextDisplayOrder(): number {
    const orders = this.catalogs().map(catalog => catalog.displayOrder);

    return orders.length === 0 ? 10 : Math.max(...orders) + 10;
  }

  private showError(summary: string, error: unknown): void {
    const httpError = error as HttpErrorResponse;
    const detail = httpError?.error?.error ?? 'Ocurrió un error inesperado.';

    this.messageService.add({ severity: 'error', summary, detail, life: 6000 });
  }
}
