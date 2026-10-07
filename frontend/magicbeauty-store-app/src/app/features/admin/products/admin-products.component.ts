import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, PrimeTemplate } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';

import { BrandService } from '../../../core/services/brand.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ProductService } from '../../../core/services/product.service';
import { Brand } from '../../../shared/models/brand.model';
import { ProductListItem } from '../../../shared/models/product.model';

interface StatusOption {
  label: string;
  value: boolean | null;
}

@Component({
  selector: 'app-admin-products',
  imports: [
    FormsModule,
    RouterLink,
    TableModule,
    PrimeTemplate,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    PageHeaderComponent,
    LoaderComponent,

  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.scss'
})
export class AdminProductsComponent {
  private readonly productService = inject(ProductService);
  private readonly brandService = inject(BrandService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);

  readonly products = signal<ProductListItem[]>([]);
  readonly brands = signal<Brand[]>([]);
  readonly loading = signal(false);

  readonly search = signal('');
  readonly brandFilter = signal<number | null>(null);
  readonly statusFilter = signal<boolean | null>(null);

  readonly statusOptions: StatusOption[] = [
    { label: 'Todos', value: null },
    { label: 'Activos', value: true },
    { label: 'Inactivos', value: false }
  ];

  readonly brandOptions = computed(() => [
    { label: 'Todas las marcas', value: null },
    ...this.brands().map(brand => ({ label: brand.name, value: brand.id }))
  ]);

  readonly activeCount = computed(() => this.products().filter(product => product.isActive).length);

  readonly totalStock = computed(() =>
    this.products().reduce((total, product) => total + product.totalQuantity, 0)
  );

  readonly withoutPrice = computed(() => this.products().filter(product => product.defaultPrice == null).length);

  constructor() {
    this.brandService.getAll().subscribe({
      next: brands => this.brands.set(brands),
      error: () => this.brands.set([])
    });

    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.productService
      .getAll({
        search: this.search().trim() || null,
        brandId: this.brandFilter(),
        isActive: this.statusFilter()
      })
      .subscribe({
        next: products => {
          this.products.set(products);
          this.loading.set(false);
        },
        error: error => {
          this.loading.set(false);
          this.showError('No se pudieron cargar los productos', error);
        }
      });
  }

  clearFilters(): void {
    this.search.set('');
    this.brandFilter.set(null);
    this.statusFilter.set(null);
    this.load();
  }

  edit(product: ProductListItem): void {
    this.router.navigate(['/admin/products', product.id]);
  }

  confirmDeactivate(product: ProductListItem): void {
    this.confirmationService.confirm({
      header: 'Desactivar producto',
      message:
        '"' + product.name + '" dejará de verse en la tienda. Su inventario y su histórico se conservan.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.deactivate(product.id)
    });
  }

  formatPrice(amount?: number | null): string {
    if (amount === null || amount === undefined) {
      return 'Sin precio';
    }

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(amount);
  }

  private deactivate(id: number): void {
    this.productService.delete(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Producto desactivado',
          detail: 'Ya no aparece en la tienda.'
        });

        this.load();
      },
      error: error => this.showError('No se pudo desactivar', error)
    });
  }

  private showError(summary: string, error: unknown): void {
    const httpError = error as HttpErrorResponse;
    const detail = httpError?.error?.error ?? 'Ocurrió un error inesperado.';

    this.messageService.add({ severity: 'error', summary, detail, life: 6000 });
  }
}
