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

  it('waits longer than the API retry budget before giving up on a login', () => {
    // Peor caso del API: ~105 s reintentando abrir la base + 15 s de SMTP.
    expect(AUTH_REQUEST_TIMEOUT_MS).toBeGreaterThan(120_000);
    expect(AUTH_REQUEST_TIMEOUT_MS).toBeLessThan(230_000); // Límite de App Service.
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
