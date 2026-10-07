import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  Category,
  CategoryMenuItem,
  CategoryTile,
  CategoryTree,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '../../shared/models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/categories`;

  getAll(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl);
  }

  getTree(): Observable<CategoryTree[]> {
    return this.http.get<CategoryTree[]>(`${this.apiUrl}/tree`);
  }

  /** Menú de la tienda: solo categorías activas y visibles en navegación. */
  getMenu(): Observable<CategoryMenuItem[]> {
    return this.http.get<CategoryMenuItem[]>(`${this.apiUrl}/menu`);
  }

  /** Categorías destacadas para la sección "Compra por categoría". */
  getHomeTiles(): Observable<CategoryTile[]> {
    return this.http.get<CategoryTile[]>(`${this.apiUrl}/home`);
  }

  getById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/${id}`);
  }

  create(request: CreateCategoryRequest): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, request);
  }

  update(id: number, request: UpdateCategoryRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}