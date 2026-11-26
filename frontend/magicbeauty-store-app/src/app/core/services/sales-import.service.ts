import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';

export interface SalesImportRun {
  id: string;
  status: 'Queued' | 'Running' | 'Succeeded' | 'Failed';
  pages: number;
  invoices: number;
  lastSuccessAt: string | null;
  error: string | null;
  from: string;
  through: string;
  unlinkedPercent: number | null;
  unlinked: { externalItemId: string; units: number }[];
}

@Injectable({ providedIn: 'root' })
export class SalesImportService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/sales/imports`;

  latest() {
    return this.http.get<SalesImportRun | null>(`${this.url}/latest`, { transferCache: false });
  }

  get(id: string) {
    return this.http.get<SalesImportRun>(`${this.url}/${encodeURIComponent(id)}`, { transferCache: false });
  }

  start(resumeId?: string) {
    const params = resumeId ? new HttpParams().set('resumeId', resumeId) : undefined;
    return this.http.post<{ id: string }>(this.url, {}, { params });
  }
}
