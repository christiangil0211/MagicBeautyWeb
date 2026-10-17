import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { AUTH_ERROR_MESSAGES, authErrorMessage } from './auth-errors';

const FALLBACK = 'No pudimos iniciar sesión. Inténtalo de nuevo.';
const httpError = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

describe('authErrorMessage', () => {
  it.each([
    [400, 'Codigo incorrecto. Te quedan 4 intento(s).'],
    [401, 'Correo o contraseña incorrectos.'],
    [429, 'Cuenta bloqueada por 15 minutos.']
  ])('shows the business message the API sends with %s', (status, message) => {
    expect(authErrorMessage(httpError(status, { error: message }), FALLBACK)).toBe(message);
  });

  it('falls back when a 4xx has no message', () => {
    expect(authErrorMessage(httpError(401), FALLBACK)).toBe(FALLBACK);
    expect(authErrorMessage(httpError(429), FALLBACK)).toBe(AUTH_ERROR_MESSAGES.tooManyAttempts);
  });

  it('explains a 503 as a service that is starting up', () => {
    expect(authErrorMessage(httpError(503, { error: 'cualquier texto' }), FALLBACK)).toBe(AUTH_ERROR_MESSAGES.unavailable);
  });

  it('never shows technical text from a 5xx', () => {
    const sqlText = 'Connection Timeout Expired. The timeout period elapsed during the post-login phase.';

    for (const status of [500, 502, 504]) {
      const message = authErrorMessage(httpError(status, { error: sqlText }), FALLBACK);

      expect(message).toBe(AUTH_ERROR_MESSAGES.unexpected);
      expect(message).not.toContain('Timeout Expired');
    }
  });

  it('separates network failures from timeouts', () => {
    expect(authErrorMessage(httpError(0), FALLBACK)).toBe(AUTH_ERROR_MESSAGES.network);
    expect(authErrorMessage(new TimeoutError(), FALLBACK)).toBe(AUTH_ERROR_MESSAGES.timeout);
  });

  it('ignores non-text bodies and unknown failures', () => {
    expect(authErrorMessage(httpError(400, { error: { detail: 'x' } }), FALLBACK)).toBe(FALLBACK);
    expect(authErrorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK);
  });
});
