import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BrandService } from '../../../core/services/brand.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PublicBrand } from '../../../shared/models/brand.model';

/**
 * /marcas: todas las marcas activas con productos completos. Las que no tienen
 * logo se muestran con su nombre en texto. El HTML inicial con la lista lo entrega
 * la función de Static Web Apps; aquí se pide en el navegador.
 */
@Component({
  selector: 'app-brands',
  imports: [RouterLink, LoaderComponent, EmptyStateComponent],
  templateUrl: './brands.component.html',
  styleUrl: './brands.component.scss'
})
export class BrandsComponent {
  readonly brands = signal<PublicBrand[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);

  private readonly brandService = inject(BrandService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.isBrowser) return;

    this.loading.set(true);
    this.loadFailed.set(false);
    this.brandService.getPublicBrands().subscribe({
      next: brands => {
        this.brands.set(brands);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      }
    });
  }
}
