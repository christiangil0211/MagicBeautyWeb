import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { publicBrandName } from '../seo/seo.model';
import { CatalogProductListItem, ProductDetail } from '../../shared/models/product.model';

export interface CatalogFilters {
  brandId?: number | null;
  categoryId?: number | null;
  search?: string | null;
  homeRanking?: boolean;
}

/**
 * Marca que ve la clienta: vacía si el producto no tiene marca. Mientras exista la
 * antigua marca "Sin marca" en la base (antes del script de datos), también se
 * oculta: en la tienda nunca aparece "SIN MARCA", simplemente no hay marca.
 */
function withPublicBrand<T extends { brandName: string }>(item: T): T {
  const brandName = publicBrandName(item.brandName) ?? '';
  return brandName === item.brandName ? item : { ...item, brandName };
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

    if (filters.homeRanking) {
      params = params.set('homeRanking', true);
    }

    if (filters.search) {
      params = params.set('search', filters.search);
    }

    return this.http
      .get<CatalogProductListItem[]>(`${this.apiUrl}/products`, { params, transferCache: false })
      .pipe(map(items => items.map(withPublicBrand)));
  }

  /** Productos de la misma categoría que el de la referencia, sin incluirlo. */
  getRelatedProducts(reference: string, limit: number): Observable<CatalogProductListItem[]> {
    return this.http.get<CatalogProductListItem[]>(
      `${this.apiUrl}/products/${encodeURIComponent(reference)}/related`,
      { params: new HttpParams().set('limit', limit), transferCache: false }
    ).pipe(map(items => items.map(withPublicBrand)));
  }

  getBestSellers(): Observable<CatalogProductListItem[]> {
    return this.http
      .get<CatalogProductListItem[]>(`${this.apiUrl}/best-sellers`, { transferCache: false })
      .pipe(map(items => items.map(withPublicBrand)));
  }

  getProductDetail(reference: string): Observable<ProductDetail> {
    return this.http
      .get<ProductDetail>(`${this.apiUrl}/products/${reference}`, { transferCache: false })
      .pipe(map(withPublicBrand));
  }
}
