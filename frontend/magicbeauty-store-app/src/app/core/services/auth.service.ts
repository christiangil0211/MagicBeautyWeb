import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ANONYMOUS_SESSION, LoginResponse, Session } from '../../shared/models/session.model';

/**
 * Refleja en la UI la sesión que mantiene el backend (cookie HttpOnly). Solo sirve
 * para mostrar u ocultar opciones: la seguridad real la aplica el API.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = `${environment.apiBaseUrl}/auth`;

  /** null mientras todavía no se consultó al backend. */
  private readonly sessionState = signal<Session | null>(null);
  private pending$: Observable<Session> | null = null;

  readonly session = this.sessionState.asReadonly();
  readonly canManageStore = computed(() => this.sessionState()?.canManageStore ?? false);
  readonly isAuthenticated = computed(() => this.sessionState()?.isAuthenticated ?? false);

  /** Devuelve la sesión conocida o la consulta una sola vez. */
  ensureSession(): Observable<Session> {
    const current = this.sessionState();

    if (current) {
      return of(current);
    }

    // En el servidor no viaja la cookie del navegador: todo render SSR es anónimo.
    if (!this.isBrowser) {
      return of(ANONYMOUS_SESSION);
    }

    this.pending$ ??= this.http.get<Session>(`${this.apiUrl}/session`).pipe(
      catchError(() => of(ANONYMOUS_SESSION)),
      tap(session => this.sessionState.set(session)),
      finalize(() => (this.pending$ = null)),
      shareReplay(1)
    );

    return this.pending$;
  }

  refresh(): Observable<Session> {
    this.sessionState.set(null);

    return this.ensureSession();
  }

  /**
   * Correo y contraseña. Si el correo aún no está confirmado, el API envía un
   * código y responde VERIFICATION_REQUIRED sin abrir la sesión.
   */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      switchMap(response =>
        response.status === 'AUTHENTICATED'
          ? this.refresh().pipe(map(() => response))
          : of(response)
      )
    );
  }

  /** Primer ingreso: cambia la contraseña temporal por una propia y abre la sesión. */
  changeTemporaryPassword(email: string, temporaryPassword: string, newPassword: string): Observable<Session> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/change-temporary-password`, { email, temporaryPassword, newPassword })
      .pipe(switchMap(() => this.refresh()));
  }

  /** Confirma el correo con el código recibido y abre la sesión. */
  verifyEmail(email: string, code: string): Observable<Session> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/verify-email`, { email, code })
      .pipe(switchMap(() => this.refresh()));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, {}).pipe(
      catchError(() => of(undefined)),
      map(() => undefined),
      tap(() => this.sessionState.set(ANONYMOUS_SESSION))
    );
  }

  /** El backend respondió 401: la sesión ya no es válida. */
  markAnonymous(): void {
    this.sessionState.set(ANONYMOUS_SESSION);
  }
}
