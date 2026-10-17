import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { AUTH_REQUEST_TIMEOUT_MS, AuthService } from '../../../core/services/auth.service';
import { LoginResponse } from '../../../shared/models/session.model';
import { AUTH_ERROR_MESSAGES } from '../../../shared/utils/auth-errors';
import { AUTH_WAIT_MESSAGES, AccountPanelComponent } from './account-panel.component';

function setup(login: () => Observable<LoginResponse>) {
  const loginSpy = vi.fn(login);
  TestBed.configureTestingModule({
    imports: [AccountPanelComponent],
    providers: [provideRouter([]), { provide: AuthService, useValue: {
      session: signal(null), canManageStore: signal(false), isAuthenticated: signal(false),
      login: loginSpy
    } }]
  });
  const fixture = TestBed.createComponent(AccountPanelComponent);
  fixture.componentRef.setInput('open', true);
  fixture.componentInstance.email.set('test@example.invalid');
  fixture.componentInstance.password.set('test-password');
  fixture.detectChanges();

  return { fixture, panel: fixture.componentInstance, loginSpy };
}

const loaderText = (element: HTMLElement) => element.querySelector('app-loader')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

it.each([null, '//external.example', '/admin/products'])('opens the home after login unless a safe return URL is present: %s', async returnUrl => {
  const { fixture, panel } = setup(() => of({ status: 'AUTHENTICATED' } as LoginResponse));
  fixture.componentRef.setInput('returnUrl', returnUrl);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  panel.submitCredentials();
  expect(navigate).toHaveBeenCalledWith(returnUrl === '/admin/products' ? returnUrl : '/inicio');
});

describe('while the API takes long to answer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the loader and explains the wait progressively', () => {
    const pending = new Subject<LoginResponse>();
    const { fixture, panel } = setup(() => pending);
    const element = fixture.nativeElement as HTMLElement;

    panel.submitCredentials();
    fixture.detectChanges();
    expect(loaderText(element)).toContain(AUTH_WAIT_MESSAGES[0].text);

    vi.advanceTimersByTime(AUTH_WAIT_MESSAGES[1].afterMs);
    fixture.detectChanges();
    expect(loaderText(element)).toContain(AUTH_WAIT_MESSAGES[1].text);

    // El último aviso aparece bien antes del corte de 15 s.
    expect(AUTH_WAIT_MESSAGES.at(-1)!.afterMs).toBeLessThan(AUTH_REQUEST_TIMEOUT_MS);

    pending.error(new HttpErrorResponse({ status: 503 }));
    fixture.detectChanges();
    expect(loaderText(element)).toBeNull();
  });

  it('sends a single request even if the user keeps pressing Ingresar', () => {
    const { panel, loginSpy } = setup(() => new Subject<LoginResponse>());

    panel.submitCredentials();
    panel.submitCredentials();
    panel.submitCredentials();

    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(panel.submitting()).toBe(true);
  });

  it('starts the next attempt with the first wait message again', () => {
    const pending = new Subject<LoginResponse>();
    const { panel } = setup(() => pending);

    panel.submitCredentials();
    vi.advanceTimersByTime(AUTH_WAIT_MESSAGES[1].afterMs);
    pending.error(new HttpErrorResponse({ status: 503 }));

    panel.submitCredentials();
    expect(panel.loaderMessage()).toBe(AUTH_WAIT_MESSAGES[0].text);
  });

  it('frees the form at 15 s with the real AuthService, keeps the credentials and allows a manual retry', () => {
    TestBed.configureTestingModule({
      imports: [AccountPanelComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AccountPanelComponent);
    const panel = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('open', true);
    panel.email.set('test@example.invalid');
    panel.password.set('test-password');

    panel.submitCredentials();
    panel.submitCredentials(); // Doble clic: sigue habiendo una sola petición.
    const first = http.expectOne(r => r.url.endsWith('/auth/login'));

    vi.advanceTimersByTime(AUTH_REQUEST_TIMEOUT_MS - 1);
    expect(panel.submitting()).toBe(true);

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(first.cancelled).toBe(true);
    expect(panel.submitting()).toBe(false);
    expect(element.querySelector('app-loader')).toBeNull();
    expect(element.querySelector('.account-panel__error')?.textContent?.trim())
      .toBe('El servicio está tardando en responder. Inténtalo nuevamente en unos segundos.');
    expect(panel.email()).toBe('test@example.invalid');
    expect(panel.password()).toBe('test-password');

    // Sin reintento automático: solo cuando el usuario vuelve a pulsar.
    http.expectNone(r => r.url.endsWith('/auth/login'));
    panel.submitCredentials();
    http.expectOne(r => r.url.endsWith('/auth/login')).flush({ status: 'VERIFICATION_REQUIRED', email: 'test@example.invalid' });
    expect(panel.step()).toBe('code');
    http.verify();
  });
});

it.each([
  [new HttpErrorResponse({ status: 503, error: { error: 'El servicio no está disponible en este momento.' } }), AUTH_ERROR_MESSAGES.unavailable],
  [new HttpErrorResponse({ status: 500, error: { error: 'Connection Timeout Expired. post-login phase' } }), AUTH_ERROR_MESSAGES.unexpected],
  [new HttpErrorResponse({ status: 0 }), AUTH_ERROR_MESSAGES.network],
  [new HttpErrorResponse({ status: 401, error: { error: 'Correo o contraseña incorrectos.' } }), 'Correo o contraseña incorrectos.']
])('unlocks the form, keeps what was typed and shows a safe message (%#)', (failure, expected) => {
  const { fixture, panel, loginSpy } = setup(() => new Observable<LoginResponse>(subscriber => subscriber.error(failure)));
  const element = fixture.nativeElement as HTMLElement;

  panel.submitCredentials();
  fixture.detectChanges();

  expect(panel.submitting()).toBe(false);
  expect(element.querySelector('app-loader')).toBeNull();
  expect(element.querySelector('.account-panel__error')?.textContent?.trim()).toBe(expected);
  expect(element.textContent).not.toContain('Timeout Expired');
  expect(panel.email()).toBe('test@example.invalid');
  expect(panel.password()).toBe('test-password');
  expect((element.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  expect(loginSpy).toHaveBeenCalledTimes(1);
});
