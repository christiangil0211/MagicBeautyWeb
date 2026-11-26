import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  Brand,
  BrandProductScope,
  BrandProductsPage,
  CreateBrandRequest,
  PublicBrand,
  PublicBrandPage,
  UpdateBrandRequest
} from '../../shared/models/brand.model';

/** Marcas: administración (api/brands) y tienda pública (api/marcas). */
@Injectable({
  providedIn: 'root'
})
export class BrandService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/brands`;
  private readonly publicUrl = `${environment.apiBaseUrl}/marcas`;

  getAll(search?: string | null): Observable<Brand[]> {
    const params = search?.trim() ? new HttpParams().set('search', search.trim()) : undefined;
    return this.http.get<Brand[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Brand> {
    return this.http.get<Brand>(`${this.apiUrl}/${id}`);
  }

  create(request: CreateBrandRequest): Observable<Brand> {
    return this.http.post<Brand>(this.apiUrl, request);
  }

  update(id: number, request: UpdateBrandRequest): Observable<Brand> {
    return this.http.put<Brand>(`${this.apiUrl}/${id}`, request);
  }

  /** Solo sin productos; con productos el API responde 400 y hay que desactivarla. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /** Un solo logo: reemplazarlo borra el anterior. */
  uploadLogo(id: number, file: File): Observable<Brand> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put<Brand>(`${this.apiUrl}/${id}/logo`, form);
  }

  deleteLogo(id: number): Observable<Brand> {
    return this.http.delete<Brand>(`${this.apiUrl}/${id}/logo`);
  }

  getProducts(id: number, scope: BrandProductScope, search: string | null, page: number, pageSize: number): Observable<BrandProductsPage> {
    let params = new HttpParams().set('scope', scope).set('page', page).set('pageSize', pageSize);
    if (search?.trim()) params = params.set('search', search.trim());
    return this.http.get<BrandProductsPage>(`${this.apiUrl}/${id}/products`, { params });
  }

  /**
   * Asigna la marca. Si algún producto ya tiene otra y no se confirmó, el API
   * responde 409 con `{ conflicts }` y no cambia nada.
   */
  assignProducts(id: number, productIds: number[], moveFromOtherBrands: boolean): Observable<{ updatedCount: number }> {
    return this.http.post<{ updatedCount: number }>(`${this.apiUrl}/${id}/products`, { productIds, moveFromOtherBrands });
  }

  /** Los productos quedan sin marca. */
  removeProducts(productIds: number[]): Observable<{ updatedCount: number }> {
    return this.http.post<{ updatedCount: number }>(`${this.apiUrl}/products/remove`, { productIds });
  }

  /** Tienda: marcas activas con productos completos. */
  getPublicBrands(): Observable<PublicBrand[]> {
    return this.http.get<PublicBrand[]>(this.publicUrl);
  }

  /** Tienda: página de una marca. 404 si no existe o está inactiva. */
  getPublicBrand(slug: string, page = 1, pageSize = 500): Observable<PublicBrandPage> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PublicBrandPage>(`${this.publicUrl}/${encodeURIComponent(slug)}`, { params });
  }
}
