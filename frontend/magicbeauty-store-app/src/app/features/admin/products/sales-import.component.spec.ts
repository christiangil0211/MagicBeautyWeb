import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SalesImportRun, SalesImportService } from '../../../core/services/sales-import.service';
import { SalesImportComponent } from './sales-import.component';

const failed: SalesImportRun = {
  id: 'interrupted',
  status: 'Failed',
  pages: 2,
  invoices: 60,
  lastSuccessAt: null,
  error: 'Falló una página.',
  from: '2026-08-26',
  through: '2026-11-26',
  unlinkedPercent: 20,
  unlinked: [{ externalItemId: 'item-21', units: 5 }]
};

it('restores a failed run without restarting it and resumes only on request', () => {
  const api = {
    latest: vi.fn(() => of(failed)),
    get: vi.fn(() => of({ ...failed, status: 'Succeeded' })),
    start: vi.fn(() => of({ id: failed.id }))
  };

  TestBed.configureTestingModule({
    imports: [SalesImportComponent],
    providers: [{ provide: SalesImportService, useValue: api }]
  });

  const fixture = TestBed.createComponent(SalesImportComponent);
  fixture.detectChanges();
  expect(api.latest).toHaveBeenCalledOnce();
  expect(api.start).not.toHaveBeenCalled();
  expect(api.get).not.toHaveBeenCalled();
  expect(fixture.nativeElement.textContent).toContain('item-21');

  const resume = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
    .find(button => button.textContent?.includes('Reanudar'));
  expect(resume).toBeDefined();
  resume!.click();

  expect(api.start).toHaveBeenCalledWith('interrupted');
  fixture.destroy();
});
