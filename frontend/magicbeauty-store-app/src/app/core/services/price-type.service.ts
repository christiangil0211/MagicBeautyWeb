import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PriceType } from '../../shared/models/price-type.model';

@Injectable({
  providedIn: 'root'
})
export class PriceTypeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/price-types`;

  /** Solo lectura: el catálogo se administra desde backend. */
  getAll(): Observable<PriceType[]> {
    return this.http.get<PriceType[]>(this.apiUrl);
  }
}
