import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Evita navegar al administrador sin permiso. Es solo experiencia de usuario: el
 * API rechaza igualmente cualquier llamada administrativa no autorizada.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureSession().pipe(
    map(session => {
      if (session.canManageStore) {
        return true;
      }

      // Vuelve al inicio con el panel de cuenta abierto; tras ingresar regresa aquí.
      return router.createUrlTree(['/'], { queryParams: { login: 1, returnUrl: state.url } });
    })
  );
};
