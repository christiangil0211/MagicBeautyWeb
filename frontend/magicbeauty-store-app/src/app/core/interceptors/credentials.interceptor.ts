import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Envía la cookie de sesión solo a nuestro API (nunca a terceros) y, si el API
 * responde 401, deja la UI en estado anónimo.
 */
export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const api = environment.apiBaseUrl.replace(/\/$/, '');
  if (request.url !== api && !request.url.startsWith(api + '/')) {
    return next(request);
  }

  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return next(request.clone({
      withCredentials: false,
      credentials: 'omit',
      headers: request.headers.delete('Cookie').delete('Authorization')
    }));
  }

  const auth = inject(AuthService);

  return next(request.clone({ withCredentials: true })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.markAnonymous();
      }

      return throwError(() => error);
    })
  );
};
