import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';

export interface CustomerImportRun {
  id: string;
  status: 'Queued' | 'Running' | 'Succeeded' | 'Failed';
  pages: number;
  contacts: number;
  skippedContacts: number;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class CustomerImportService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/customers/imports`;

  latest() {
    return this.http.get<CustomerImportRun | null>(`${this.url}/latest`, { transferCache: false });
  }

  get(id: string) {
    return this.http.get<CustomerImportRun>(`${this.url}/${encodeURIComponent(id)}`, { transferCache: false });
  }

  start() {
    return this.http.post<{ id: string }>(this.url, {});
  }
}
