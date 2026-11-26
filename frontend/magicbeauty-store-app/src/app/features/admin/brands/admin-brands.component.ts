import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Observable, concatMap, finalize, of } from 'rxjs';

import { BrandService } from '../../../core/services/brand.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { Brand } from '../../../shared/models/brand.model';
import { BrandProductsComponent } from './brand-products/brand-products.component';

/** Formatos y tamaño del logo; el API valida lo mismo por el contenido del archivo. */
export const LOGO_ACCEPT = 'image/png,image/svg+xml,image/webp';
export const LOGO_MAX_BYTES = 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/svg+xml', 'image/webp'];

/** "Kevin & Coco" → "kevin-coco"; "PÚRPURE" → "purpure". Igual que el API. */
export function brandSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/, '');
}

/**
 * Admin › Marcas. Misma estructura que Admin › Categorías: lista a la izquierda,
 * formulario a la derecha y, debajo, los productos de la marca. Un producto tiene
 * una sola marca; sin marca es válido.
 */
@Component({
  selector: 'app-admin-brands',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    ToggleSwitchModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    PageHeaderComponent,
    LoaderComponent,
    BrandProductsComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-brands.component.html',
  styleUrl: './admin-brands.component.scss'
})
export class AdminBrandsComponent {
  private readonly brandService = inject(BrandService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly logoAccept = LOGO_ACCEPT;

  readonly brands = signal<Brand[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly search = signal('');
  readonly selectedId = signal<number | null>(null);

  /** Logo elegido y aún no guardado, o logo marcado para quitar al guardar. */
  readonly pendingLogo = signal<File | null>(null);
  readonly pendingLogoPreview = signal<string | null>(null);
  readonly removeLogo = signal(false);

  readonly selectedBrand = computed(() => this.brands().find(brand => brand.id === this.selectedId()));

  /** La búsqueda ignora tildes y mayúsculas, como en el API. */
  readonly visibleBrands = computed(() => {
    const term = brandSlug(this.search()).replace(/-/g, '');
    return term ? this.brands().filter(brand => brandSlug(brand.name).replace(/-/g, '').includes(term)) : this.brands();
  });

  readonly activeCount = computed(() => this.brands().filter(brand => brand.isActive).length);
  readonly featuredCount = computed(() => this.brands().filter(brand => brand.isFeatured).length);
  readonly withoutLogoCount = computed(() => this.brands().filter(brand => brand.isActive && !brand.logoUrl).length);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    slug: ['', [Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), Validators.maxLength(120)]],
    description: ['', Validators.maxLength(300)],
    sortOrder: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
    isFeatured: [false]
  });

  /** El slug sigue al nombre mientras la persona no lo haya escrito a mano. */
  private slugEditedByHand = false;

  /** Logo que se ve en el formulario: el pendiente, el guardado o ninguno. */
  readonly logoPreview = computed(() => {
    if (this.pendingLogoPreview()) return this.pendingLogoPreview();
    if (this.removeLogo()) return null;
    return this.selectedBrand()?.logoUrl ?? null;
  });

  constructor() {
    this.load();
  }

  load(selectId: number | null = this.selectedId()): void {
    this.loading.set(true);
    this.brandService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: brands => {
          this.brands.set(brands);
          if (selectId != null && brands.some(brand => brand.id === selectId)) {
            this.select(brands.find(brand => brand.id === selectId)!);
          }
        },
        error: error => this.showError('No se pudieron cargar las marcas', error)
      });
  }

  select(brand: Brand): void {
    this.selectedId.set(brand.id);
    this.slugEditedByHand = true;
    this.clearPendingLogo();
    this.form.reset({
      name: brand.name,
      slug: brand.slug,
      description: brand.description ?? '',
      sortOrder: brand.sortOrder,
      isActive: brand.isActive,
      isFeatured: brand.isFeatured
    });
  }

  newBrand(): void {
    this.selectedId.set(null);
    this.slugEditedByHand = false;
    this.clearPendingLogo();
    this.form.reset({ name: '', slug: '', description: '', sortOrder: 0, isActive: true, isFeatured: false });
  }

  nameChanged(): void {
    if (!this.slugEditedByHand) {
      this.form.controls.slug.setValue(brandSlug(this.form.controls.name.value));
    }
  }

  slugTyped(): void {
    this.slugEditedByHand = this.form.controls.slug.value.trim().length > 0;
  }

  selectLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!LOGO_TYPES.includes(file.type)) {
      this.warn('Revisa el logo', 'Usa un archivo PNG, SVG o WebP.');
      return;
    }

    if (file.size === 0 || file.size > LOGO_MAX_BYTES) {
      this.warn('Revisa el logo', 'El logo debe pesar como máximo 1 MB.');
      return;
    }

    this.clearPendingLogo();
    this.pendingLogo.set(file);
    this.pendingLogoPreview.set(URL.createObjectURL(file));
  }

  markLogoForRemoval(): void {
    this.clearPendingLogo();
    this.removeLogo.set(true);
  }

  save(): void {
    if (this.saving()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.warn('Revisa el formulario', 'El nombre es obligatorio y la URL solo admite minúsculas, números y guiones.');
      return;
    }

    const value = this.form.getRawValue();
    const request = {
      name: value.name.trim(),
      slug: value.slug.trim() || null,
      description: value.description.trim() || null,
      sortOrder: value.sortOrder,
      isActive: value.isActive,
      isFeatured: value.isFeatured
    };
    const current = this.selectedBrand();
    const logo = this.pendingLogo();
    const removeLogo = this.removeLogo();

    this.saving.set(true);

    const saved$: Observable<Brand> = current
      ? this.brandService.update(current.id, request)
      : this.brandService.create(request);

    saved$
      .pipe(
        // El logo se sube después de guardar: una marca nueva necesita su Id.
        concatMap(brand =>
          logo ? this.brandService.uploadLogo(brand.id, logo) : removeLogo && brand.logoUrl ? this.brandService.deleteLogo(brand.id) : of(brand)
        ),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: brand => {
          this.messageService.add({ severity: 'success', summary: 'Marca guardada', detail: `"${brand.name}" quedó guardada.` });
          this.clearPendingLogo();
          this.load(brand.id);
        },
        error: error => this.showError('No se pudo guardar la marca', error)
      });
  }

  /** Con productos no se borra: se ofrece desactivarla. */
  confirmDelete(): void {
    const brand = this.selectedBrand();
    if (!brand) return;

    if (brand.productCount > 0) {
      this.confirmationService.confirm({
        header: 'La marca tiene productos',
        message: `"${brand.name}" tiene ${brand.productCount} producto(s), así que no se puede eliminar. ¿Quieres desactivarla? Deja de verse en la tienda y sus productos conservan la marca.`,
        icon: 'pi pi-eye-slash',
        acceptLabel: 'Desactivar',
        rejectLabel: 'Cancelar',
        rejectButtonStyleClass: 'p-button-text',
        accept: () => {
          this.form.controls.isActive.setValue(false);
          this.save();
        }
      });
      return;
    }

    this.confirmationService.confirm({
      header: 'Eliminar marca',
      message: `¿Eliminar "${brand.name}"? También se borra su logo. No tiene productos.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () =>
        this.brandService.delete(brand.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Marca eliminada', detail: `"${brand.name}" se eliminó.` });
            this.newBrand();
            this.load(null);
          },
          error: error => this.showError('No se pudo eliminar la marca', error)
        })
    });
  }

  /** Al asignar o quitar productos cambian los conteos de las marcas. */
  productsChanged(): void {
    this.load();
  }

  private clearPendingLogo(): void {
    const preview = this.pendingLogoPreview();
    if (preview) URL.revokeObjectURL(preview);
    this.pendingLogo.set(null);
    this.pendingLogoPreview.set(null);
    this.removeLogo.set(false);
  }

  private warn(summary: string, detail: string): void {
    this.messageService.add({ severity: 'warn', summary, detail });
  }

  private showError(summary: string, error: unknown): void {
    const detail =
      error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
        ? error.error.error
        : 'Intenta de nuevo en unos segundos.';
    this.messageService.add({ severity: 'error', summary, detail });
  }
}
