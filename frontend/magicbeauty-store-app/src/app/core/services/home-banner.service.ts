import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { HomeBanner, PublicHomeBanner, SaveHomeBannerRequest } from '../../shared/models/home-banner.model';

/** Banners del inicio: administración (api/home-banners) y tienda (api/banners). */
@Injectable({
  providedIn: 'root'
})
export class HomeBannerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/home-banners`;
  private readonly publicUrl = `${environment.apiBaseUrl}/banners`;

  getAll(): Observable<HomeBanner[]> {
    return this.http.get<HomeBanner[]>(this.apiUrl);
  }

  /** Lo crea al final del carrusel. La imagen se sube después (necesita el Id). */
  create(request: SaveHomeBannerRequest): Observable<HomeBanner> {
    return this.http.post<HomeBanner>(this.apiUrl, request);
  }

  update(id: number, request: SaveHomeBannerRequest): Observable<HomeBanner> {
    return this.http.put<HomeBanner>(`${this.apiUrl}/${id}`, request);
  }

  /** También borra sus imágenes del almacenamiento. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /** Original 3:1 y, si el navegador pudo generarlas, copias livianas de 768 y 1280 px. */
  uploadImage(id: number, file: File, copies: { image768?: Blob; image1280?: Blob } = {}): Observable<HomeBanner> {
    const form = new FormData();
    form.append('file', file);
    if (copies.image768) form.append('file768', copies.image768, 'banner-768.webp');
    if (copies.image1280) form.append('file1280', copies.image1280, 'banner-1280.webp');
    return this.http.put<HomeBanner>(`${this.apiUrl}/${id}/image`, form);
  }

  /** Todos los Id, del primero al último. */
  reorder(ids: number[]): Observable<HomeBanner[]> {
    return this.http.put<HomeBanner[]>(`${this.apiUrl}/order`, { ids });
  }

  /** Tienda: los que se ven hoy, en orden. */
  getVisible(): Observable<PublicHomeBanner[]> {
    return this.http.get<PublicHomeBanner[]>(this.publicUrl);
  }
}
