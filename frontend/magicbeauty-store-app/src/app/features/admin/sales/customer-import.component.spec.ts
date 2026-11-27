import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CustomerImportRun, CustomerImportService } from '../../../core/services/customer-import.service';
import { CustomerImportComponent } from './customer-import.component';

it('only starts a customer import after the administrator requests it', async () => {
  const complete: CustomerImportRun = {
    id: 'contacts', status: 'Succeeded', pages: 1, contacts: 10, skippedContacts: 2, error: null
  };
  const api = {
    latest: vi.fn(() => of(null)),
    start: vi.fn(() => of({ id: complete.id })),
    get: vi.fn(() => of(complete))
  };
  TestBed.configureTestingModule({
    imports: [CustomerImportComponent],
    providers: [{ provide: CustomerImportService, useValue: api }]
  });
  const fixture = TestBed.createComponent(CustomerImportComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  expect(api.latest).not.toHaveBeenCalled();

  component.show();
  expect(api.latest).toHaveBeenCalledOnce();
  expect(api.start).not.toHaveBeenCalled();
  component.start();

  await vi.waitFor(() => expect(component.run()).toEqual(complete));
  expect(api.start).toHaveBeenCalledOnce();
  expect(component.busy()).toBe(false);
  fixture.destroy();
});
