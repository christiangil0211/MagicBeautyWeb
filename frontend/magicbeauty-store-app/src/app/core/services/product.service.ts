import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AdjustInventoryRequest,
  ProductDetail,
  CreateProductRequest,
  CreateProductVariantRequest,
  InventoryMovement,
  Product,
  ProductImage,
  ProductImageRequest,
  ProductListItem,
  ProductVariant,
  UpdateProductRequest,
  UpdateProductVariantRequest,
  UpsertProductPriceRequest
} from '../../shared/models/product.model';

export interface ProductFilters {
  brandId?: number | null;
  categoryId?: number | null;
  isActive?: boolean | null;
  search?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/products`;
  private readonly catalogUrl = `${environment.apiBaseUrl}/catalog`;

  /** Ficha pública: solo el precio aplicable, sin variante interna ni inactivos. */
  getPublicDetail(reference: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.catalogUrl}/products/${reference}`);
  }

  getAll(filters: ProductFilters = {}): Observable<ProductListItem[]> {
    let params = new HttpParams();

    if (filters.brandId != null) {
      params = params.set('brandId', filters.brandId);
    }

    if (filters.categoryId != null) {
      params = params.set('categoryId', filters.categoryId);
    }

    if (filters.isActive != null) {
      params = params.set('isActive', filters.isActive);
    }

    if (filters.search) {
      params = params.set('search', filters.search);
    }

    return this.http.get<ProductListItem[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  getByReference(reference: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/by-reference/${reference}`);
  }

  create(request: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, request);
  }

  update(id: number, request: UpdateProductRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, request);
  }

  /** Desactivación lógica: el producto conserva su histórico. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  setCategories(id: number, categoryIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/categories`, { categoryIds });
  }

  setPrices(id: number, prices: UpsertProductPriceRequest[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/prices`, { prices });
  }

  getVariants(productId: number): Observable<ProductVariant[]> {
    return this.http.get<ProductVariant[]>(`${this.apiUrl}/${productId}/variants`);
  }

  addVariant(productId: number, request: CreateProductVariantRequest): Observable<ProductVariant> {
    return this.http.post<ProductVariant>(`${this.apiUrl}/${productId}/variants`, request);
  }

  updateVariant(variantId: number, request: UpdateProductVariantRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/variants/${variantId}`, request);
  }

  deleteVariant(variantId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/variants/${variantId}`);
  }

  /** Única vía para cambiar existencias: actualiza cantidad y deja el movimiento. */
  adjustInventory(variantId: number, request: AdjustInventoryRequest): Observable<ProductVariant> {
    return this.http.post<ProductVariant>(
      `${this.apiUrl}/variants/${variantId}/inventory`,
      request
    );
  }

  getMovements(variantId: number): Observable<InventoryMovement[]> {
    return this.http.get<InventoryMovement[]>(`${this.apiUrl}/variants/${variantId}/movements`);
  }

  getImages(productId: number): Observable<ProductImage[]> {
    return this.http.get<ProductImage[]>(`${this.apiUrl}/${productId}/images`);
  }

  addImage(productId: number, request: ProductImageRequest): Observable<ProductImage> {
    return this.http.post<ProductImage>(`${this.apiUrl}/${productId}/images`, request);
  }

  updateImage(imageId: number, request: ProductImageRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/images/${imageId}`, request);
  }

  deleteImage(imageId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/images/${imageId}`);
  }
}
