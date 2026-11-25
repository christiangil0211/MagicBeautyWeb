import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';

/*
 * Integración con Alegra (desmontable). Todo lo de Alegra en el frontend vive en
 * esta carpeta; para retirarla basta con borrarla y quitar <app-alegra-sync-button>
 * de la pantalla de productos.
 */

export type AlegraSyncIssueKind = 'skipped' | 'error' | 'warning';

export interface AlegraSyncIssue {
  kind: AlegraSyncIssueKind;
  reference?: string | null;
  name?: string | null;
  message: string;
}

export interface AlegraSyncResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Productos existentes asociados por primera vez a su ítem de Alegra (por referencia). */
  linked: number;
  skipped: number;
  failed: number;
  startedAt: string;
  finishedAt: string;
  issues: AlegraSyncIssue[];
}

@Injectable({ providedIn: 'root' })
export class AlegraService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/integrations/alegra`;

  /** Si la integración está activa y configurada. Ante cualquier error se asume que no. */
  isEnabled(): Observable<boolean> {
    return this.http.get<{ enabled: boolean }>(`${this.apiUrl}/status`).pipe(
      map((status) => status.enabled === true),
      catchError(() => of(false)),
    );
  }

  /** Actualiza (o crea) los productos de la tienda con los ítems de Alegra. */
  syncProducts(): Observable<AlegraSyncResult> {
    return this.http.post<AlegraSyncResult>(`${this.apiUrl}/products/sync`, {});
  }
}
