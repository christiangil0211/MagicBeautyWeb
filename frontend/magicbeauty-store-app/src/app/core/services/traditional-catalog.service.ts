import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PublicTraditionalCatalog,
  SaveTraditionalCatalogRequest,
  TraditionalCatalog,
  TraditionalCatalogFile
} from '../../shared/models/traditional-catalog.model';

@Injectable({
  providedIn: 'root'
})
export class TraditionalCatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/traditional-catalogs`;

  /**
   * PDF destacado (banner y Beneficios): el del primer catálogo publicado que lo
   * tenga, en el orden de la administración. Se consulta una vez por visita; si
   * falla, se vuelve a intentar en el siguiente uso.
   */
  private readonly featuredPdfUrl$ = this.getPublic().pipe(
    map(catalogs => catalogs.find(catalog => catalog.pdfUrl)?.pdfUrl ?? null),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  /** Tienda: solo catálogos activos, en el orden configurado. */
  getPublic(): Observable<PublicTraditionalCatalog[]> {
    return this.http.get<PublicTraditionalCatalog[]>(`${this.apiUrl}/public`);
  }

  getFeaturedPdfUrl(): Observable<string | null> {
    return this.featuredPdfUrl$.pipe(catchError(() => of(null)));
  }

  getAll(): Observable<TraditionalCatalog[]> {
    return this.http.get<TraditionalCatalog[]>(this.apiUrl);
  }

  create(request: SaveTraditionalCatalogRequest): Observable<TraditionalCatalog> {
    return this.http.post<TraditionalCatalog>(this.apiUrl, request);
  }

  update(id: number, request: SaveTraditionalCatalogRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  uploadFile(id: number, kind: TraditionalCatalogFile, file: File): Observable<TraditionalCatalog> {
    const form = new FormData();
    form.append('file', file, file.name);

    return this.http.put<TraditionalCatalog>(`${this.apiUrl}/${id}/${kind}`, form);
  }

  deleteFile(id: number, kind: TraditionalCatalogFile): Observable<TraditionalCatalog> {
    return this.http.delete<TraditionalCatalog>(`${this.apiUrl}/${id}/${kind}`);
  }
}
