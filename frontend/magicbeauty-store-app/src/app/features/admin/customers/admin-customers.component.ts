import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { Observable, Subscription } from 'rxjs';

import { CustomerAdminService } from '../../../core/services/customer-admin.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import {
  AdminCommercialRole, AdminCustomer, AdminCustomerFilters, AdminCustomerPage, PendingRoleRequest
} from '../../../shared/models/customer-admin.model';
import { authErrorMessage } from '../../../shared/utils/auth-errors';
import { formatCop } from '../../../shared/utils/currency';

type View = 'customers' | 'requests';
type Edit =
  | { kind: 'role' | 'active'; customer: AdminCustomer }
  | { kind: 'decision'; request: PendingRoleRequest; approve: boolean };

const EMPTY_FILTERS: AdminCustomerFilters = { roleCode: null, isActive: null, city: '', search: '' };
const PAGE_SIZE = 25;
const NOTE_MAX_LENGTH = 1000;

@Component({
  selector: 'app-admin-customers',
  imports: [
    DatePipe, FormsModule, ButtonModule, DialogModule, InputTextModule, PaginatorModule, SelectModule,
    TableModule, TagModule, TextareaModule, LoaderComponent, PageHeaderComponent
  ],
  templateUrl: './admin-customers.component.html',
  styleUrl: './admin-customers.component.scss'
})
export class AdminCustomersComponent {
  private readonly api = inject(CustomerAdminService);
  private readonly destroyRef = inject(DestroyRef);
  private customerRequest?: Subscription;
  private requestList?: Subscription;
  private customerPageNumber = 1;
  private requestPageNumber = 1;
  private appliedFilters = { ...EMPTY_FILTERS };

  readonly pageSize = PAGE_SIZE;
  readonly noteMaxLength = NOTE_MAX_LENGTH;
  readonly formatAmount = formatCop;
  readonly statusOptions = [{ label: 'Activas', value: true }, { label: 'Inactivas', value: false }];

  filters = { ...EMPTY_FILTERS };
  readonly view = signal<View>('customers');
  readonly customers = signal<AdminCustomerPage<AdminCustomer> | null>(null);
  readonly requests = signal<AdminCustomerPage<PendingRoleRequest> | null>(null);
  readonly roles = signal<AdminCommercialRole[]>([]);
  readonly customersLoading = signal(false);
  readonly requestsLoading = signal(false);
  readonly customerError = signal('');
  readonly requestError = signal('');
  readonly rolesError = signal('');
  readonly notice = signal('');

  readonly edit = signal<Edit | null>(null);
  readonly roleCode = signal<string | null>(null);
  readonly note = signal('');
  readonly mutationError = signal('');
  readonly saving = signal(false);
  readonly editHeading = computed(() => {
    const edit = this.edit();
    if (edit?.kind === 'decision') return edit.approve ? 'Aprobar solicitud' : 'Rechazar solicitud';
    if (edit?.kind === 'active') return edit.customer.isActive ? 'Inactivar cuenta' : 'Activar cuenta';
    return 'Cambiar rol comercial';
  });

  ngOnInit(): void {
    this.loadRoles();
    this.loadCustomers(1);
  }

  show(view: View): void {
    if (view === this.view()) return;
    this.view.set(view);
    this.notice.set('');
    this.reload();
  }

  applyFilters(): void {
    this.appliedFilters = { ...this.filters, city: this.filters.city.trim(), search: this.filters.search.trim() };
    this.loadCustomers(1);
  }

  clearFilters(): void {
    this.filters = { ...EMPTY_FILTERS };
    this.applyFilters();
  }

  changeCustomerPage(event: { first?: number }): void {
    this.loadCustomers(Math.floor((event.first ?? 0) / PAGE_SIZE) + 1);
  }

  changeRequestPage(event: { first?: number }): void {
    this.loadRequests(Math.floor((event.first ?? 0) / PAGE_SIZE) + 1);
  }

  reload(): void {
    if (this.view() === 'customers') this.loadCustomers(this.customerPageNumber);
    else this.loadRequests(this.requestPageNumber);
  }

  loadRoles(): void {
    this.rolesError.set('');
    this.api.commercialRoles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: roles => this.roles.set(roles),
      error: error => this.rolesError.set(authErrorMessage(error, 'No se pudieron consultar los roles comerciales.'))
    });
  }

  review(request: PendingRoleRequest, approve: boolean): void {
    this.openEdit({ kind: 'decision', request, approve });
  }

  changeRole(customer: AdminCustomer): void {
    this.openEdit({ kind: 'role', customer });
    this.roleCode.set(customer.roleCode);
  }

  changeActive(customer: AdminCustomer): void {
    this.openEdit({ kind: 'active', customer });
  }

  close(): void {
    if (this.saving()) return;
    this.edit.set(null);
    this.note.set('');
    this.roleCode.set(null);
    this.mutationError.set('');
  }

  refreshAfterError(): void {
    if (this.saving()) return;
    this.close();
    this.reload();
  }

  save(): void {
    const edit = this.edit();
    if (!edit || this.saving()) return;

    this.mutationError.set('');
    const mutation = this.makeMutation(edit);
    if (!mutation) return;

    this.saving.set(true);
    mutation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.close();
        this.notice.set(edit.kind === 'decision' ? 'La decisión quedó registrada.' : 'La cuenta quedó actualizada.');
        this.reload();
      },
      error: error => {
        this.saving.set(false);
        this.mutationError.set(authErrorMessage(error, 'No se pudo guardar el cambio.'));
      }
    });
  }

  private makeMutation(edit: Edit): Observable<void> | null {
    // Conserva las versiones que vio el operador. Un error no reintenta la acción con datos nuevos.
    if (edit.kind === 'decision') {
      const { id, rowVersion, userRowVersion } = edit.request;
      const note = this.note().trim();
      if (!note || note.length > NOTE_MAX_LENGTH) {
        this.mutationError.set('Escribe una nota de hasta 1000 caracteres.');
        return null;
      }
      if (rowVersion && userRowVersion)
        return this.api.decide(id, { approve: edit.approve, note, rowVersion, userRowVersion });
    } else if (edit.customer.rowVersion) {
      const { id, rowVersion, isActive } = edit.customer;
      if (edit.kind === 'active') return this.api.changeActive(id, !isActive, rowVersion);
      const role = this.roleCode();
      if (role && role !== edit.customer.roleCode && this.roles().some(option => option.code === role))
        return this.api.changeRole(id, role, rowVersion);
      this.mutationError.set('Selecciona un rol comercial distinto del actual.');
      return null;
    }

    this.mutationError.set('Falta la versión de los datos. Actualiza la lista y vuelve a revisar.');
    return null;
  }

  private openEdit(edit: Edit): void {
    if (this.saving()) return;
    this.close();
    this.notice.set('');
    this.edit.set(edit);
  }

  private loadCustomers(page: number): void {
    this.customerRequest?.unsubscribe();
    this.customerPageNumber = page;
    this.customersLoading.set(true);
    this.customerError.set('');
    this.customerRequest = this.api.customers(this.appliedFilters, page, PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
          if (page > lastPage) {
            this.loadCustomers(lastPage);
            return;
          }
          this.customers.set(result);
          this.customersLoading.set(false);
        },
        error: error => {
          this.customers.set(null);
          this.customersLoading.set(false);
          this.customerError.set(authErrorMessage(error, 'No se pudieron consultar las cuentas de clientes.'));
        }
      });
  }

  private loadRequests(page: number): void {
    this.requestList?.unsubscribe();
    this.requestPageNumber = page;
    this.requestsLoading.set(true);
    this.requestError.set('');
    this.requestList = this.api.pendingRequests(page, PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
          if (page > lastPage) {
            this.loadRequests(lastPage);
            return;
          }
          this.requests.set(result);
          this.requestsLoading.set(false);
        },
        error: error => {
          this.requests.set(null);
          this.requestsLoading.set(false);
          this.requestError.set(authErrorMessage(error, 'No se pudieron consultar las solicitudes pendientes.'));
        }
      });
  }
}
