import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay } from 'rxjs';

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
   * Catálogos públicos: una sola consulta por visita, compartida entre el PDF
   * destacado (Beneficios) y la pestaña de catálogos. Si falla, el siguiente uso la
   * repite; cualquier cambio desde la administración la descarta.
   */
  private publicCatalogs$: Observable<PublicTraditionalCatalog[]> | null = null;

  /** Tienda: solo catálogos activos, en el orden configurado. */
  getPublic(): Observable<PublicTraditionalCatalog[]> {
    this.publicCatalogs$ ??= this.http
      .get<PublicTraditionalCatalog[]>(`${this.apiUrl}/public`)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));

    return this.publicCatalogs$;
  }

  /**
   * PDF destacado (banner y Beneficios): el del primer catálogo publicado que lo
   * tenga, en el orden de la administración.
   */
  getFeaturedPdfUrl(): Observable<string | null> {
    return this.getPublic().pipe(
      map(catalogs => catalogs.find(catalog => catalog.pdfUrl)?.pdfUrl ?? null),
      catchError(() => of(null))
    );
  }

  getAll(): Observable<TraditionalCatalog[]> {
    return this.http.get<TraditionalCatalog[]>(this.apiUrl);
  }

  create(request: SaveTraditionalCatalogRequest): Observable<TraditionalCatalog> {
    return this.changed(this.http.post<TraditionalCatalog>(this.apiUrl, request));
  }

  update(id: number, request: SaveTraditionalCatalogRequest): Observable<void> {
    return this.changed(this.http.put<void>(`${this.apiUrl}/${id}`, request));
  }

  delete(id: number): Observable<void> {
    return this.changed(this.http.delete<void>(`${this.apiUrl}/${id}`));
  }

  uploadFile(id: number, kind: TraditionalCatalogFile, file: File): Observable<TraditionalCatalog> {
    const form = new FormData();
    form.append('file', file, file.name);

    return this.changed(this.http.put<TraditionalCatalog>(`${this.apiUrl}/${id}/${kind}`, form));
  }

  deleteFile(id: number, kind: TraditionalCatalogFile): Observable<TraditionalCatalog> {
    return this.changed(this.http.delete<TraditionalCatalog>(`${this.apiUrl}/${id}/${kind}`));
  }

  /** Tras un cambio (aunque falle a medias) la tienda vuelve a pedir la lista. */
  private changed<T>(request: Observable<T>): Observable<T> {
    return request.pipe(finalize(() => (this.publicCatalogs$ = null)));
  }
}
