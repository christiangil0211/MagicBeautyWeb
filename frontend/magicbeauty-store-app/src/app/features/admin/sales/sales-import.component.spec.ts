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
  fixture.componentInstance.show();
  fixture.detectChanges();

  const resume = Array.from(document.body.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
    .find(button => button.textContent?.includes('Reanudar'));
  expect(resume).toBeDefined();
  resume!.click();

  expect(api.start).toHaveBeenCalledWith('interrupted');
  fixture.destroy();
});

it('locks the modal while a run is active and refreshes only after the final state', async () => {
  const running: SalesImportRun = { ...failed, status: 'Running', error: null };
  const api = {
    latest: vi.fn(() => of(running)),
    get: vi.fn(() => of({ ...running, status: 'Succeeded' })),
    start: vi.fn()
  };

  TestBed.configureTestingModule({
    imports: [SalesImportComponent],
    providers: [{ provide: SalesImportService, useValue: api }]
  });

  const fixture = TestBed.createComponent(SalesImportComponent);
  const component = fixture.componentInstance;
  const settled = vi.fn();
  component.settled.subscribe(settled);
  fixture.detectChanges();

  expect(component.busy()).toBe(true);
  component.close();
  component.start();
  expect(component.open()).toBe(true);
  expect(api.start).not.toHaveBeenCalled();
  expect(settled).not.toHaveBeenCalled();

  await vi.waitFor(() => expect(settled).toHaveBeenCalledOnce());
  expect(component.step()).toBe('result');
  expect(component.busy()).toBe(false);
  fixture.destroy();
});
