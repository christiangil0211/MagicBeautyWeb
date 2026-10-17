import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, TimeoutError } from 'rxjs';
import { vi } from 'vitest';

import { AUTH_REQUEST_TIMEOUT_MS, AuthService } from './auth.service';

describe('AuthService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  it('gives up after 15 s, just after the API budget of 13 s', () => {
    expect(AUTH_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(AUTH_REQUEST_TIMEOUT_MS).toBeGreaterThan(13_000);
  });

  it('counts the session check after a login inside the same 15 s', () => {
    const http = TestBed.inject(HttpTestingController);
    const error = vi.fn();

    TestBed.inject(AuthService).login('a@example.invalid', 'x').subscribe({ error });
    vi.advanceTimersByTime(10_000);
    http.expectOne(r => r.url.endsWith('/auth/login')).flush({ status: 'AUTHENTICATED' });
    const session = http.expectOne(r => r.url.endsWith('/auth/session'));

    vi.advanceTimersByTime(AUTH_REQUEST_TIMEOUT_MS - 10_000);
    expect(error).toHaveBeenCalledWith(expect.any(TimeoutError));

    // La consulta de sesión es compartida y no se corta: si llega tarde, la UI se
    // entera de que el login sí funcionó.
    session.flush({ isAuthenticated: true, displayName: 'a@example.invalid', canManageStore: false });
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
  });

  it.each<[string, (auth: AuthService) => Observable<unknown>, string]>([
    ['login', auth => auth.login('a@example.invalid', 'x'), '/auth/login'],
    ['verifyEmail', auth => auth.verifyEmail('a@example.invalid', '123456'), '/auth/verify-email'],
    ['changeTemporaryPassword', auth => auth.changeTemporaryPassword('a@example.invalid', 'x', 'y'), '/auth/change-temporary-password']
  ])('%s fails with a timeout and cancels the request when the API never answers', (_, call, path) => {
    const http = TestBed.inject(HttpTestingController);
    const error = vi.fn();

    call(TestBed.inject(AuthService)).subscribe({ error });
    const request = http.expectOne(r => r.url.endsWith(path));

    vi.advanceTimersByTime(AUTH_REQUEST_TIMEOUT_MS - 1);
    expect(error).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(error).toHaveBeenCalledWith(expect.any(TimeoutError));
    expect(request.cancelled).toBe(true);
  });

  it('does not retry a failed login on its own', () => {
    const http = TestBed.inject(HttpTestingController);
    const error = vi.fn();

    TestBed.inject(AuthService).login('a@example.invalid', 'x').subscribe({ error });
    http.expectOne(r => r.url.endsWith('/auth/login')).flush({ error: 'x' }, { status: 503, statusText: 'Service Unavailable' });

    expect(error).toHaveBeenCalledTimes(1);
    http.expectNone(r => r.url.endsWith('/auth/login'));
  });
});
