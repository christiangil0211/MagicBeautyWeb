import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, PrimeTemplate } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { forkJoin, switchMap } from 'rxjs';

import { BrandService } from '../../../core/services/brand.service';
import { CategoryService } from '../../../core/services/category.service';
import { PriceTypeService } from '../../../core/services/price-type.service';
import { ProductService } from '../../../core/services/product.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { Brand } from '../../../shared/models/brand.model';
import { Category } from '../../../shared/models/category.model';
import { PriceType } from '../../../shared/models/price-type.model';
import {
  InventoryMovementCode,
  Product,
  ProductImage,
  ProductVariant,
  UpsertProductPriceRequest
} from '../../../shared/models/product.model';

const REFERENCE_PATTERN = /^[A-Za-z]{3}[0-9]{3}$/;

/** Mismo límite que valida el API (ImageUploadRules.MaxBytes). */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

interface MovementOption {
  label: string;
  value: InventoryMovementCode;
}

@Component({
  selector: 'app-admin-product-form',
  imports: [
    ReactiveFormsModule,
    LoaderComponent,
    RouterLink,
    PrimeTemplate,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    InputNumberModule,
    ToggleSwitchModule,
    TagModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-product-form.component.html',
  styleUrl: './admin-product-form.component.scss'
})
export class AdminProductFormComponent {
  private readonly productService = inject(ProductService);
  private readonly brandService = inject(BrandService);
  private readonly categoryService = inject(CategoryService);
  private readonly priceTypeService = inject(PriceTypeService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);

  /** Llega del parámetro de ruta. Sin él, el formulario está en modo creación. */
  readonly id = input<string | undefined>(undefined);

  readonly product = signal<Product | null>(null);
  readonly brands = signal<Brand[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly priceTypes = signal<PriceType[]>([]);
  readonly variants = signal<ProductVariant[]>([]);
  readonly images = signal<ProductImage[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly catalogsReady = signal(false);

  readonly isEditMode = computed(() => this.product() !== null);

  readonly brandOptions = computed(() =>
    this.brands()
      .filter(brand => brand.isActive || brand.id === this.product()?.brandId)
      .map(brand => ({ label: brand.name, value: brand.id }))
  );

  /** Se muestran con sangría para que se entienda el nivel dentro del árbol. */
  readonly categoryOptions = computed(() => {
    const all = this.categories();
    const options: { label: string; value: number }[] = [];

    const walk = (parentId: number | null, level: number): void => {
      for (const category of all
        .filter(item => (item.parentCategoryId ?? null) === parentId)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))) {
        options.push({
          label: '  '.repeat(level) + category.name,
          value: category.id
        });

        walk(category.id, level + 1);
      }
    };

    walk(null, 0);

    return options;
  });

  /** Variantes que el administrador debe ver: la interna DEFAULT nunca aparece. */
  readonly visibleVariants = computed(() => this.variants().filter(variant => !variant.isDefault));

  readonly defaultVariant = computed(() => this.variants().find(variant => variant.isDefault) ?? null);

  readonly totalStock = computed(() =>
    this.variants()
      .filter(variant => variant.isActive)
      .reduce((total, variant) => total + variant.quantity, 0)
  );

  readonly movementOptions: MovementOption[] = [
    { label: 'Entrada de mercancía', value: 'IN' },
    { label: 'Venta en línea', value: 'SALE_ONLINE' },
    { label: 'Venta en tienda física', value: 'SALE_PHYSICAL' },
    { label: 'Ajuste de inventario', value: 'ADJUSTMENT' }
  ];

  readonly form = this.formBuilder.nonNullable.group({
    reference: ['', [Validators.required, Validators.pattern(REFERENCE_PATTERN)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    brandId: [null as number | null, Validators.required],
    categoryIds: [[] as number[]],
    isActive: [true],
    hasVariants: [false],
    initialQuantity: [0, [Validators.required, Validators.min(0)]],
    prices: this.formBuilder.array<ReturnType<AdminProductFormComponent['buildPriceRow']>>([]),
    variants: this.formBuilder.array<ReturnType<AdminProductFormComponent['buildVariantRow']>>([])
  });

  /** Alta de variante cuando el producto ya existe. */
  readonly newVariantForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    code: [''],
    colorHex: [''],
    quantity: [0, [Validators.required, Validators.min(0)]],
    displayOrder: [0, [Validators.required, Validators.min(0)]]
  });

  /** Archivo elegido para subir; si hay uno, la URL se ignora. */
  readonly selectedFile = signal<File | null>(null);
  readonly uploadingImage = signal(false);

  readonly imageForm = this.formBuilder.nonNullable.group({
    url: [''],
    altText: [''],
    productVariantId: [null as number | null],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
    isMain: [false],
    isActive: [true]
  });

  readonly inventoryForm = this.formBuilder.nonNullable.group({
    type: ['IN' as InventoryMovementCode, Validators.required],
    quantity: [1, Validators.required],
    reason: ['']
  });

  readonly inventoryTarget = signal<ProductVariant | null>(null);

  constructor() {
    forkJoin({
      brands: this.brandService.getAll(),
      categories: this.categoryService.getAll(),
      priceTypes: this.priceTypeService.getAll()
    }).subscribe({
      next: ({ brands, categories, priceTypes }) => {
        this.brands.set(brands);
        this.categories.set(categories);
        this.priceTypes.set(priceTypes);
        this.buildPriceRows(priceTypes);
        this.catalogsReady.set(true);
      },
      error: error => this.showError('No se pudieron cargar los catálogos', error)
    });

    effect(() => {
      const routeId = this.id();

      if (!this.catalogsReady()) {
        return;
      }

      if (routeId) {
        this.loadProduct(Number(routeId));
      }
    });
  }

  get priceRows(): FormArray {
    return this.form.controls.prices as unknown as FormArray;
  }

  get variantRows(): FormArray {
    return this.form.controls.variants as unknown as FormArray;
  }

  addVariantRow(): void {
    this.variantRows.push(this.buildVariantRow(this.variantRows.length + 1));
  }

  removeVariantRow(index: number): void {
    this.variantRows.removeAt(index);
  }

  onHasVariantsChange(hasVariants: boolean): void {
    if (hasVariants) {
      this.form.controls.initialQuantity.setValue(0);

      if (this.variantRows.length === 0) {
        this.addVariantRow();
      }

      return;
    }

    this.variantRows.clear();
  }

  save(): void {
    if (this.form.controls.name.invalid || this.form.controls.brandId.invalid) {
      this.form.markAllAsTouched();
      this.warn('Revisa el formulario', 'Nombre y marca son obligatorios.');

      return;
    }

    const prices = this.collectPrices();

    if (prices === null) {
      return;
    }

    if (this.isEditMode()) {
      this.saveExisting(prices);

      return;
    }

    this.createNew(prices);
  }

  adjustInventory(variant: ProductVariant): void {
    this.inventoryTarget.set(variant);
    this.inventoryForm.reset({ type: 'IN', quantity: 1, reason: '' });
  }

  closeInventory(): void {
    this.inventoryTarget.set(null);
  }

  submitInventory(): void {
    const variant = this.inventoryTarget();

    if (!variant || this.inventoryForm.invalid) {
      return;
    }

    const value = this.inventoryForm.getRawValue();

    this.productService
      .adjustInventory(variant.id, {
        type: value.type,
        quantity: value.quantity,
        reason: value.reason.trim() || null
      })
      .subscribe({
        next: updated => {
          this.variants.update(list =>
            list.map(item => (item.id === updated.id ? updated : item))
          );
          this.closeInventory();
          this.notify('Inventario actualizado', 'Nuevas existencias: ' + updated.quantity + '.');
        },
        error: error => this.showError('No se pudo ajustar el inventario', error)
      });
  }

  addVariant(): void {
    const product = this.product();

    if (!product || this.newVariantForm.invalid) {
      this.newVariantForm.markAllAsTouched();

      return;
    }

    const value = this.newVariantForm.getRawValue();

    this.productService
      .addVariant(product.id, {
        name: value.name.trim(),
        code: value.code.trim() || null,
        colorHex: value.colorHex.trim() || null,
        quantity: value.quantity,
        displayOrder: value.displayOrder
      })
      .subscribe({
        next: () => {
          this.newVariantForm.reset({ name: '', code: '', colorHex: '', quantity: 0, displayOrder: 0 });
          this.reloadVariants(product.id);
          this.notify('Tono agregado', 'La variante quedó disponible.');
        },
        error: error => this.showError('No se pudo agregar el tono', error)
      });
  }

  toggleVariantActive(variant: ProductVariant): void {
    this.productService
      .updateVariant(variant.id, {
        name: variant.name,
        code: variant.code,
        colorHex: variant.colorHex,
        displayOrder: variant.displayOrder,
        isActive: !variant.isActive
      })
      .subscribe({
        next: () => {
          const product = this.product();

          if (product) {
            this.reloadVariants(product.id);
          }
        },
        error: error => this.showError('No se pudo actualizar el tono', error)
      });
  }

  onFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;

    if (file && file.size > MAX_IMAGE_BYTES) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Imagen muy pesada',
        detail: 'El máximo es 8 MB. Reduce el tamaño de la foto e inténtalo de nuevo.'
      });
      input.value = '';
      this.selectedFile.set(null);

      return;
    }

    this.selectedFile.set(file);
  }

  clearSelectedFile(input: HTMLInputElement): void {
    input.value = '';
    this.selectedFile.set(null);
  }

  /** Sube el archivo elegido o, si no hay, registra la URL escrita. */
  addImage(fileInput: HTMLInputElement): void {
    const product = this.product();
    const file = this.selectedFile();
    const value = this.imageForm.getRawValue();

    if (!product || this.imageForm.invalid || this.uploadingImage()) {
      this.imageForm.markAllAsTouched();

      return;
    }

    if (!file && !value.url.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Falta la imagen',
        detail: 'Elige una foto de tu equipo o escribe una URL.'
      });

      return;
    }

    const options = {
      altText: value.altText.trim() || null,
      productVariantId: value.productVariantId,
      displayOrder: value.displayOrder,
      isMain: value.isMain
    };

    const request$ = file
      ? this.productService.uploadImage(product.id, file, options)
      : this.productService.addImage(product.id, { ...options, url: value.url.trim(), isActive: value.isActive });

    this.uploadingImage.set(true);

    request$.subscribe({
      next: () => {
        this.uploadingImage.set(false);
        this.clearSelectedFile(fileInput);
        this.imageForm.reset({
          url: '',
          altText: '',
          productVariantId: null,
          displayOrder: 0,
          isMain: false,
          isActive: true
        });
        this.reloadImages(product.id);
        this.notify('Imagen agregada', 'Ya aparece en la galería del producto.');
      },
      error: error => {
        this.uploadingImage.set(false);
        this.showError('No se pudo agregar la imagen', error);
      }
    });
  }

  deleteImage(image: ProductImage): void {
    this.confirmationService.confirm({
      header: 'Eliminar imagen',
      message: 'Se quitará esta imagen del producto.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.productService.deleteImage(image.id).subscribe({
          next: () => {
            const product = this.product();

            if (product) {
              this.reloadImages(product.id);
            }
          },
          error: error => this.showError('No se pudo eliminar la imagen', error)
        });
      }
    });
  }

  variantName(variantId?: number | null): string {
    if (!variantId) {
      return 'General del producto';
    }

    return this.variants().find(variant => variant.id === variantId)?.name ?? 'Variante';
  }

  variantOptions(): { label: string; value: number | null }[] {
    return [
      { label: 'General del producto', value: null },
      ...this.visibleVariants().map(variant => ({ label: variant.name, value: variant.id }))
    ];
  }

  private loadProduct(id: number): void {
    this.loading.set(true);

    this.productService.getById(id).subscribe({
      next: product => {
        this.product.set(product);
        this.variants.set(product.variants);
        this.images.set(product.images);
        this.patchForm(product);
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.showError('No se pudo cargar el producto', error);
      }
    });
  }

  private patchForm(product: Product): void {
    this.form.patchValue({
      reference: product.reference,
      name: product.name,
      description: product.description ?? '',
      brandId: product.brandId,
      categoryIds: product.categories.map(category => category.categoryId),
      isActive: product.isActive,
      hasVariants: product.hasVariants,
      initialQuantity: 0
    });

    // Reference y hasVariants son inmutables en backend: se bloquean también aquí.
    this.form.controls.reference.disable();
    this.form.controls.hasVariants.disable();
    this.variantRows.clear();

    for (const row of this.priceRows.controls) {
      const priceTypeId = row.get('priceTypeId')!.value as number;
      const existing = product.prices.find(price => price.priceTypeId === priceTypeId);

      row.get('amount')!.setValue(existing ? existing.amount : null);
      row.get('isActive')!.setValue(existing ? existing.isActive : true);
    }
  }

  private buildPriceRows(priceTypes: PriceType[]): void {
    this.priceRows.clear();

    for (const priceType of priceTypes) {
      this.priceRows.push(this.buildPriceRow(priceType));
    }
  }

  private buildPriceRow(priceType: PriceType) {
    return this.formBuilder.group({
      priceTypeId: [priceType.id],
      code: [priceType.code],
      name: [priceType.name],
      isDefault: [priceType.isDefault],
      isPublic: [priceType.isPublic],
      amount: [null as number | null],
      isActive: [true]
    });
  }

  private buildVariantRow(displayOrder: number) {
    return this.formBuilder.group({
      name: ['', Validators.required],
      code: [''],
      colorHex: [''],
      quantity: [0, [Validators.required, Validators.min(0)]],
      displayOrder: [displayOrder, [Validators.required, Validators.min(0)]]
    });
  }

  /** Devuelve null cuando falta el precio predeterminado, que es obligatorio. */
  private collectPrices(): UpsertProductPriceRequest[] | null {
    const rows = this.priceRows.getRawValue() as {
      priceTypeId: number;
      code: string;
      isDefault: boolean;
      amount: number | null;
      isActive: boolean;
    }[];

    const defaultRow = rows.find(row => row.isDefault);

    if (defaultRow && (defaultRow.amount === null || defaultRow.amount === undefined)) {
      this.warn(
        'Falta el precio ' + defaultRow.code,
        'Es el precio que ve el cliente, así que es obligatorio.'
      );

      return null;
    }

    return rows
      .filter(row => row.amount !== null && row.amount !== undefined)
      .map(row => ({
        priceTypeId: row.priceTypeId,
        amount: row.amount as number,
        isActive: row.isActive
      }));
  }

  private createNew(prices: UpsertProductPriceRequest[]): void {
    if (this.form.controls.reference.invalid) {
      this.form.controls.reference.markAsTouched();
      this.warn('Referencia inválida', 'Deben ser 3 letras y 3 números. Ejemplo: ABC123.');

      return;
    }

    const value = this.form.getRawValue();

    if (value.hasVariants && this.variantRows.length === 0) {
      this.warn('Faltan los tonos', 'Un producto con tonos necesita al menos una variante.');

      return;
    }

    if (value.hasVariants && this.variantRows.invalid) {
      this.variantRows.markAllAsTouched();
      this.warn('Revisa los tonos', 'Cada tono necesita nombre y cantidad.');

      return;
    }

    this.saving.set(true);

    this.productService
      .create({
        reference: value.reference.trim().toUpperCase(),
        name: value.name.trim(),
        description: value.description.trim() || null,
        brandId: value.brandId as number,
        hasVariants: value.hasVariants,
        isActive: value.isActive,
        initialQuantity: value.hasVariants ? 0 : value.initialQuantity,
        categoryIds: value.categoryIds,
        prices,
        variants: value.hasVariants
          ? (this.variantRows.getRawValue() as {
              name: string;
              code: string;
              colorHex: string;
              quantity: number;
              displayOrder: number;
            }[]).map(row => ({
              name: row.name.trim(),
              code: row.code.trim() || null,
              colorHex: row.colorHex.trim() || null,
              quantity: row.quantity,
              displayOrder: row.displayOrder
            }))
          : []
      })
      .subscribe({
        next: created => {
          this.saving.set(false);
          this.notify('Producto creado', created.reference + ' quedó en el catálogo.');
          this.router.navigate(['/admin/products', created.id]);
        },
        error: error => {
          this.saving.set(false);
          this.showError('No se pudo crear el producto', error);
        }
      });
  }

  private saveExisting(prices: UpsertProductPriceRequest[]): void {
    const product = this.product();

    if (!product) {
      return;
    }

    const value = this.form.getRawValue();

    this.saving.set(true);

    this.productService
      .update(product.id, {
        name: value.name.trim(),
        description: value.description.trim() || null,
        brandId: value.brandId as number,
        isActive: value.isActive
      })
      .pipe(
        switchMap(() => this.productService.setCategories(product.id, value.categoryIds)),
        switchMap(() => this.productService.setPrices(product.id, prices))
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify('Cambios guardados', 'El producto quedó actualizado.');
          this.loadProduct(product.id);
        },
        error: error => {
          this.saving.set(false);
          this.showError('No se pudieron guardar los cambios', error);
        }
      });
  }

  private reloadVariants(productId: number): void {
    this.productService.getVariants(productId).subscribe({
      next: variants => this.variants.set(variants),
      error: error => this.showError('No se pudieron cargar los tonos', error)
    });
  }

  private reloadImages(productId: number): void {
    this.productService.getImages(productId).subscribe({
      next: images => this.images.set(images),
      error: error => this.showError('No se pudieron cargar las imágenes', error)
    });
  }

  private notify(summary: string, detail: string): void {
    this.messageService.add({ severity: 'success', summary, detail });
  }

  private warn(summary: string, detail: string): void {
    this.messageService.add({ severity: 'warn', summary, detail });
  }

  private showError(summary: string, error: unknown): void {
    const httpError = error as HttpErrorResponse;
    const detail = httpError?.error?.error ?? 'Ocurrió un error inesperado.';

    this.messageService.add({ severity: 'error', summary, detail, life: 6000 });
  }
}
