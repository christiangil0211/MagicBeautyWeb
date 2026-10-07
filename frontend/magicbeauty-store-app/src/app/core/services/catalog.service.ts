import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CatalogProductListItem, ProductDetail } from '../../shared/models/product.model';

export interface CatalogFilters {
  brandId?: number | null;
  categoryId?: number | null;
  search?: string | null;
}

/**
 * Lecturas de la tienda. El backend ya entrega solo productos activos y solo los
 * precios que quien consulta puede ver: aquí no se filtra ni se oculta nada.
 *
 * Sin transferCache: el render SSR siempre es anónimo y sus precios no deben
 * reutilizarse en el navegador de un usuario con sesión.
 */
@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/catalog`;

  getProducts(filters: CatalogFilters = {}): Observable<CatalogProductListItem[]> {
    let params = new HttpParams();

    if (filters.brandId != null) {
      params = params.set('brandId', filters.brandId);
    }

    if (filters.categoryId != null) {
      params = params.set('categoryId', filters.categoryId);
    }

    if (filters.search) {
      params = params.set('search', filters.search);
    }

    return this.http.get<CatalogProductListItem[]>(`${this.apiUrl}/products`, {
      params,
      transferCache: false
    });
  }

  getProductDetail(reference: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.apiUrl}/products/${reference}`, {
      transferCache: false
    });
  }
}
