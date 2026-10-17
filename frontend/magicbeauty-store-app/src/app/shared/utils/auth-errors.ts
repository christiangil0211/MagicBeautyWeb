import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

export const AUTH_ERROR_MESSAGES = {
  network: 'No pudimos conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.',
  timeout: 'El servicio está tardando en responder. Inténtalo nuevamente en unos segundos.',
  unavailable: 'El servicio está tardando en responder. Inténtalo nuevamente en unos segundos.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
  tooManyAttempts: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'
} as const;

/**
 * Mensaje para el usuario según la respuesta. Solo los 4xx traen texto pensado para
 * mostrarse (credenciales, código, bloqueo); los 5xx, la red y los timeouts se
 * explican con textos propios, sin repetir nada técnico que llegue del servidor.
 */
export function authErrorMessage(failure: unknown, fallback: string): string {
  if (failure instanceof TimeoutError) {
    return AUTH_ERROR_MESSAGES.timeout;
  }

  if (!(failure instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (failure.status === 0) {
    return AUTH_ERROR_MESSAGES.network;
  }

  if (failure.status === 503) {
    return AUTH_ERROR_MESSAGES.unavailable;
  }

  if (failure.status >= 500) {
    return AUTH_ERROR_MESSAGES.unexpected;
  }

  const apiMessage = typeof failure.error?.error === 'string' ? failure.error.error.trim() : '';

  if (apiMessage) {
    return apiMessage;
  }

  return failure.status === 429 ? AUTH_ERROR_MESSAGES.tooManyAttempts : fallback;
}
