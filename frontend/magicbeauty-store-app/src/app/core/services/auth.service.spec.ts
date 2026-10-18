import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, TimeoutError } from 'rxjs';
import { vi } from 'vitest';

import { Session } from '../../shared/models/session.model';
import { AUTH_REQUEST_TIMEOUT_MS, AuthService } from './auth.service';

const LOGIN = (url: string) => url.endsWith('/auth/login');
const SESSION = (url: string) => url.endsWith('/auth/session');
const ADMIN: Session = { isAuthenticated: true, displayName: 'admin@example.invalid', canManageStore: true };
const ANONYMOUS: Session = { isAuthenticated: false, displayName: null, canManageStore: false };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('gives up after 15 s, just after the API budget of 13 s', () => {
    expect(AUTH_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(AUTH_REQUEST_TIMEOUT_MS).toBeGreaterThan(13_000);
  });

  it('confirms the session right after a successful login', () => {
    const next = vi.fn();

    auth.login('a@example.invalid', 'x').subscribe(next);
    http.expectOne(r => LOGIN(r.url)).flush({ status: 'AUTHENTICATED' });
    http.expectOne(r => SESSION(r.url)).flush(ADMIN);

    expect(next).toHaveBeenCalledWith({ response: { status: 'AUTHENTICATED' }, session: 'confirmed' });
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.canManageStore()).toBe(true);
  });

  it('waits for a slow session check within the same 15 s', () => {
    const next = vi.fn();

    auth.login('a@example.invalid', 'x').subscribe(next);
    vi.advanceTimersByTime(4_000);
    http.expectOne(r => LOGIN(r.url)).flush({ status: 'AUTHENTICATED' });
    vi.advanceTimersByTime(9_000); // 13 s en total: todavía dentro del plazo.
    http.expectOne(r => SESSION(r.url)).flush(ADMIN);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ session: 'confirmed' }));
  });

  it('reports a session that did not arrive in time as pending, never as a login error, and lets it land later', () => {
    const next = vi.fn();
    const error = vi.fn();

    auth.login('a@example.invalid', 'x').subscribe({ next, error });
    vi.advanceTimersByTime(10_000);
    http.expectOne(r => LOGIN(r.url)).flush({ status: 'AUTHENTICATED' });
    const session = http.expectOne(r => SESSION(r.url));

    // El POST consumió 10 s: la sesión solo tiene los 5 s que quedan.
    vi.advanceTimersByTime(AUTH_REQUEST_TIMEOUT_MS - 10_000);
    expect(error).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ session: 'pending' }));
    expect(session.cancelled).toBe(false);

    session.flush(ADMIN);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('reports a session check that fails as pending and leaves the state unknown so it is asked again', () => {
    const next = vi.fn();

    auth.login('a@example.invalid', 'x').subscribe(next);
    http.expectOne(r => LOGIN(r.url)).flush({ status: 'AUTHENTICATED' });
    http.expectOne(r => SESSION(r.url)).flush(null, { status: 0, statusText: 'Unknown Error' });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ session: 'pending' }));
    expect(auth.session()).toBeNull();

    // La siguiente navegación lo vuelve a consultar: sin SQL, sin repetir el login.
    auth.ensureSession().subscribe();
    http.expectOne(r => SESSION(r.url)).flush(ADMIN);
    expect(auth.isAuthenticated()).toBe(true);
    http.expectNone(r => LOGIN(r.url));
  });

  it('reports rejected when the API answers but the browser kept no session', () => {
    const next = vi.fn();

    auth.login('a@example.invalid', 'x').subscribe(next);
    http.expectOne(r => LOGIN(r.url)).flush({ status: 'AUTHENTICATED' });
    http.expectOne(r => SESSION(r.url)).flush(ANONYMOUS);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ session: 'rejected' }));
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('does not reuse a session check that started before the login cookie existed', () => {
    const next = vi.fn();

    // La página pidió la sesión al cargar; esa respuesta (anónima) llega después del login.
    auth.ensureSession().subscribe();
    const stale = http.expectOne(r => SESSION(r.url));

    auth.login('a@example.invalid', 'x').subscribe(next);
    http.expectOne(r => LOGIN(r.url)).flush({ status: 'AUTHENTICATED' });
    const fresh = http.expectOne(r => SESSION(r.url));

    fresh.flush(ADMIN);
    stale.flush(ANONYMOUS);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ session: 'confirmed' }));
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('ignores a late session answer after a logout', () => {
    auth.login('a@example.invalid', 'x').subscribe();
    vi.advanceTimersByTime(1_000);
    http.expectOne(r => LOGIN(r.url)).flush({ status: 'AUTHENTICATED' });
    const late = http.expectOne(r => SESSION(r.url));
    vi.advanceTimersByTime(AUTH_REQUEST_TIMEOUT_MS);

    auth.logout().subscribe();
    http.expectOne(r => r.url.endsWith('/auth/logout')).flush(null);
    late.flush(ADMIN);

    expect(auth.isAuthenticated()).toBe(false);
  });

  it.each<[string, (service: AuthService) => Observable<unknown>, string]>([
    ['login', service => service.login('a@example.invalid', 'x'), '/auth/login'],
    ['verifyEmail', service => service.verifyEmail('a@example.invalid', '123456'), '/auth/verify-email'],
    ['changeTemporaryPassword', service => service.changeTemporaryPassword('a@example.invalid', 'x', 'y'), '/auth/change-temporary-password']
  ])('%s fails with a timeout and cancels the request when the API never answers', (_, call, path) => {
    const error = vi.fn();

    call(auth).subscribe({ error });
    const request = http.expectOne(r => r.url.endsWith(path));

    vi.advanceTimersByTime(AUTH_REQUEST_TIMEOUT_MS - 1);
    expect(error).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(error).toHaveBeenCalledWith(expect.any(TimeoutError));
    expect(request.cancelled).toBe(true);
  });

  it('keeps verify-email and password change inside one 15 s budget too', () => {
    const next = vi.fn();

    auth.verifyEmail('a@example.invalid', '123456').subscribe(next);
    vi.advanceTimersByTime(12_000);
    http.expectOne(r => r.url.endsWith('/auth/verify-email')).flush({ status: 'AUTHENTICATED' });
    http.expectOne(r => SESSION(r.url));

    vi.advanceTimersByTime(AUTH_REQUEST_TIMEOUT_MS - 12_000);
    expect(next).toHaveBeenCalledWith('pending');
  });

  it('does not retry a failed login on its own', () => {
    const error = vi.fn();

    auth.login('a@example.invalid', 'x').subscribe({ error });
    http.expectOne(r => LOGIN(r.url)).flush({ error: 'x' }, { status: 503, statusText: 'Service Unavailable' });

    expect(error).toHaveBeenCalledTimes(1);
    http.expectNone(r => LOGIN(r.url));
  });
});
