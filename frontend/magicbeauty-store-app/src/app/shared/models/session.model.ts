/** Sesión actual según el API. El backend sigue siendo la autoridad de permisos. */
export interface Session {
  isAuthenticated: boolean;
  displayName?: string | null;
  /** Resultado de la política de administración del backend, no de un rol leído aquí. */
  canManageStore: boolean;
}

export const ANONYMOUS_SESSION: Session = {
  isAuthenticated: false,
  displayName: null,
  canManageStore: false
};

export type LoginStatus = 'AUTHENTICATED' | 'VERIFICATION_REQUIRED' | 'PASSWORD_CHANGE_REQUIRED';

export interface LoginResponse {
  status: LoginStatus;
  /** Correo al que se envió el código cuando hay que verificarlo. */
  email?: string | null;
}
