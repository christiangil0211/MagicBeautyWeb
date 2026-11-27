import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  AdminCommercialRole, AdminCustomer, AdminCustomerFilters, AdminCustomerPage,
  CommercialRoleDecision, PendingRoleRequest
} from '../../shared/models/customer-admin.model';

@Injectable({ providedIn: 'root' })
export class CustomerAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/customers`;

  customers(filters: AdminCustomerFilters, page: number, pageSize: number) {
    let params = this.pageParams(page, pageSize);
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== '') params = params.set(key, value);
    }

    return this.http.get<AdminCustomerPage<AdminCustomer>>(this.url, { params, transferCache: false });
  }

  commercialRoles() {
    return this.http.get<AdminCommercialRole[]>(`${this.url}/commercial-roles`, { transferCache: false });
  }

  pendingRequests(page: number, pageSize: number) {
    return this.http.get<AdminCustomerPage<PendingRoleRequest>>(`${this.url}/role-requests`, {
      params: this.pageParams(page, pageSize), transferCache: false
    });
  }

  decide(id: number, decision: CommercialRoleDecision) {
    return this.http.post<void>(`${this.url}/role-requests/${id}/decision`, decision);
  }

  changeRole(id: number, roleCode: string, rowVersion: string) {
    return this.http.put<void>(`${this.url}/${id}/role`, { roleCode, rowVersion });
  }

  changeActive(id: number, isActive: boolean, rowVersion: string) {
    return this.http.put<void>(`${this.url}/${id}/active`, { isActive, rowVersion });
  }

  private pageParams(page: number, pageSize: number): HttpParams {
    return new HttpParams().set('page', page).set('pageSize', pageSize);
  }
}
