export interface AdminCustomer {
  id: number;
  fullName: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  documentNumber: string | null;
  roleCode: string;
  roleName: string;
  isActive: boolean;
  emailConfirmed: boolean;
  rowVersion: string;
}

export interface AdminCommercialRole {
  code: string;
  name: string;
}

export interface PendingRoleRequest {
  id: number;
  fullName: string | null;
  email: string;
  documentNumber: string;
  requestedRoleCode: string;
  requestedRoleName: string;
  createdAt: string;
  lastPurchaseAt: string | null;
  invoiceCount: number;
  total: number;
  rowVersion: string;
  userRowVersion: string;
}

export interface AdminCustomerFilters {
  roleCode: string | null;
  isActive: boolean | null;
  city: string;
  search: string;
}

export interface AdminCustomerPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CommercialRoleDecision {
  approve: boolean;
  note: string;
  rowVersion: string;
  userRowVersion: string;
}
