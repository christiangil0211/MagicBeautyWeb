import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { AdminCustomersComponent } from './admin-customers.component';

const api = `${environment.apiBaseUrl}/admin/customers`;
const customer = {
  id: 4, fullName: 'Cliente de prueba', email: 'cliente@example.invalid', phone: null,
  city: 'Cali', documentNumber: null, roleCode: 'CUSTOMER_RETAIL', roleName: 'Detal',
  emailConfirmed: true, isActive: true, rowVersion: 'AAAAAAAAAAE='
};
const request = {
  id: 6, fullName: 'Cliente de prueba', email: 'cliente@example.invalid', documentNumber: '12345',
  requestedRoleCode: 'CUSTOMER_WHOLESALE', requestedRoleName: 'Mayorista', createdAt: '2026-11-01',
  invoiceCount: 0, total: 0, lastPurchaseAt: null, rowVersion: 'AAAAAAAAAAg=', userRowVersion: 'AAAAAAAAAAE='
};
const page = <T>(items: T[], currentPage = 1) => ({ items, total: 75, page: currentPage, pageSize: 25 });

function setup() {
  TestBed.configureTestingModule({
    imports: [AdminCustomersComponent],
    providers: [provideHttpClient(), provideHttpClientTesting()]
  });
  const fixture = TestBed.createComponent(AdminCustomersComponent);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(`${api}/commercial-roles`).flush([
    { code: 'CUSTOMER_RETAIL', name: 'Detal' }, { code: 'CUSTOMER_WHOLESALE', name: 'Mayorista' }
  ]);
  http.expectOne(`${api}?page=1&pageSize=25`).flush(page([customer]));
  return { fixture, component: fixture.componentInstance, http };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

it('applies all filters and retains them when navigating the results', () => {
  const { component, http } = setup();
  component.filters = { roleCode: 'CUSTOMER_RETAIL', isActive: false, city: ' Cali ', search: ' Ana ' };
  component.applyFilters();
  for (const targetPage of [1, 2]) {
    if (targetPage === 2) component.changeCustomerPage({ first: 25 });
    const request = http.expectOne(req => req.url === api);
    expect(request.request.params.get('page')).toEqual(String(targetPage));
    expect(request.request.params.get('roleCode')).toBe('CUSTOMER_RETAIL');
    expect(request.request.params.get('isActive')).toBe('false');
    expect(request.request.params.get('city')).toBe('Cali');
    expect(request.request.params.get('search')).toBe('Ana');
    request.flush(page([customer], targetPage));
  }
});

it('requires a note and uses both versions when recording a decision', () => {
  const { fixture, component, http } = setup();
  component.show('requests');
  http.expectOne(`${api}/role-requests?page=1&pageSize=25`).flush(page([request]));
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Sin compras registradas');

  component.review(request, true);
  component.note.set(' ');
  component.save();
  http.expectNone(`${api}/role-requests/6/decision`);
  component.note.set(' Compras revisadas ');
  component.save();
  const pending = http.expectOne(`${api}/role-requests/6/decision`);
  expect(pending.request.method).toBe('POST');
  expect(pending.request.body).toEqual({
    approve: true, note: 'Compras revisadas', rowVersion: request.rowVersion, userRowVersion: request.userRowVersion
  });
  pending.flush(null, { status: 204, statusText: 'No Content' });
  http.expectOne(`${api}/role-requests?page=1&pageSize=25`).flush(page([]));
});

it('keeps a failed change explicit and refreshes before taking a new version', () => {
  const { component, http } = setup();
  component.changeRole(customer);
  component.roleCode.set('CUSTOMER_WHOLESALE');
  component.save();
  const pending = http.expectOne(`${api}/4/role`);
  expect(pending.request.body).toEqual({ roleCode: 'CUSTOMER_WHOLESALE', rowVersion: customer.rowVersion });
  pending.flush({ error: 'Los datos del cliente cambiaron.' }, { status: 409, statusText: 'Conflict' });
  expect(component.mutationError()).toContain('Los datos del cliente cambiaron.');

  component.refreshAfterError();
  const updated = { ...customer, rowVersion: 'AAAAAAAAAAM=' };
  http.expectOne(`${api}?page=1&pageSize=25`).flush(page([updated]));
  component.changeActive(updated);
  component.save();
  const activation = http.expectOne(`${api}/4/active`);
  expect(activation.request.body).toEqual({ isActive: false, rowVersion: updated.rowVersion });
  activation.flush(null, { status: 204, statusText: 'No Content' });
  http.expectOne(`${api}?page=1&pageSize=25`).flush(page([updated]));
});
