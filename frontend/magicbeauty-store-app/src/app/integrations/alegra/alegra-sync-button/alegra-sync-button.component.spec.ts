import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AlegraService, AlegraSyncResult } from '../alegra.service';
import { AlegraSyncButtonComponent } from './alegra-sync-button.component';

function result(overrides: Partial<AlegraSyncResult> = {}): AlegraSyncResult {
  return {
    total: 4,
    created: 1,
    updated: 2,
    unchanged: 0,
    linked: 2,
    skipped: 1,
    failed: 0,
    startedAt: '',
    finishedAt: '',
    issues: [{ kind: 'skipped', reference: '12345', name: 'Sin formato', message: 'La referencia no tiene el formato de la tienda.' }],
    ...overrides,
  };
}

function setup(enabled: boolean, sync: () => Observable<AlegraSyncResult> = () => of(result())) {
  const api = { isEnabled: vi.fn(() => of(enabled)), syncProducts: vi.fn(sync) };
  TestBed.configureTestingModule({
    imports: [AlegraSyncButtonComponent],
    providers: [{ provide: AlegraService, useValue: api }],
  });
  const fixture = TestBed.createComponent(AlegraSyncButtonComponent);
  const synced = vi.fn();
  fixture.componentInstance.synced.subscribe(synced);
  fixture.detectChanges();
  return { api, fixture, synced, component: fixture.componentInstance };
}

const text = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
const body = () => document.body;

afterEach(() => document.body.querySelectorAll('.p-dialog-mask').forEach((mask) => mask.remove()));

it('stays hidden while the integration is not active', () => {
  const { fixture } = setup(false);

  expect((fixture.nativeElement as HTMLElement).querySelector('p-button')).toBeNull();
});

it('asks for confirmation before calling Alegra', () => {
  const { api, fixture, component } = setup(true);
  expect(text((fixture.nativeElement as HTMLElement).querySelector('p-button'))).toBe('Actualizar desde Alegra');

  component.openDialog();
  fixture.detectChanges();

  expect(text(body().querySelector('.alegra-intro'))).toContain('se cruza por su id de Alegra');
  expect(text(body().querySelector('.alegra-intro'))).toContain('se crean inactivas');
  expect(api.syncProducts).not.toHaveBeenCalled();
});

it('shows the progress, then the summary with the issues, and tells the page to reload', () => {
  const pending = new Subject<AlegraSyncResult>();
  const { fixture, component, synced } = setup(true, () => pending);
  component.openDialog();

  component.run();
  fixture.detectChanges();
  expect(component.step()).toBe('running');
  expect(text(body().querySelector('app-loader'))).toContain('Actualizando productos desde Alegra');
  // No se lanza una segunda actualización mientras corre la primera.
  component.run();

  pending.next(result());
  pending.complete();
  fixture.detectChanges();

  expect(component.step()).toBe('result');
  const stat = (element: Element) => text(element.querySelector('strong')) + ' ' + text(element.querySelector('span'));
  expect(Array.from(body().querySelectorAll('.alegra-stat'), stat)).toEqual([
    '4 leídos', '2 actualizados', '1 creados', '0 sin cambios', '1 omitidos', '0 con error',
  ]);
  expect(text(body().querySelector('.alegra-issue__kind'))).toBe('Omitido');
  expect(text(body().querySelector('.alegra-issue__text'))).toBe('12345 Sin formato · La referencia no tiene el formato de la tienda.');
  expect(Array.from(body().querySelectorAll('.alegra-note'), text)).toEqual([
    '2 productos se asociaron a su ítem de Alegra por la referencia. Desde ahora se actualizan por el id de Alegra.',
    'Los productos creados quedaron inactivos: asígnales categorías e imágenes y actívalos.',
  ]);
  expect(synced).toHaveBeenCalledOnce();
});

it('does not reload the page when nothing changed', () => {
  const { component, synced } = setup(true, () => of(result({ created: 0, updated: 0, unchanged: 4, linked: 0, skipped: 0, issues: [] })));
  component.openDialog();

  component.run();

  expect(component.step()).toBe('result');
  expect(synced).not.toHaveBeenCalled();
});

it('shows the API message when Alegra fails and lets the admin retry', () => {
  let calls = 0;
  const { fixture, component } = setup(true, () =>
    ++calls === 1
      ? throwError(() => ({ error: { error: 'Alegra rechazó las credenciales. Revisa el correo y el token de la integración.' } }))
      : of(result()),
  );
  component.openDialog();

  component.run();
  fixture.detectChanges();
  expect(component.step()).toBe('error');
  expect(text(body().querySelector('.alegra-error'))).toBe('Alegra rechazó las credenciales. Revisa el correo y el token de la integración.');

  component.run();
  expect(component.step()).toBe('result');
});
