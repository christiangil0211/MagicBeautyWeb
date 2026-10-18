import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, timeout } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ANONYMOUS_SESSION, LoginResponse, Session } from '../../shared/models/session.model';

/**
 * Espera máxima visible de login, verificación y cambio de contraseña, contando la
 * consulta de sesión posterior: ambas comparten este mismo plazo. El API corta a los
 * 13 s y responde 503; este límite cubre lo que el API no controla (red, arranque en
 * frío). Al vencer se cancela el POST, y la cancelación llega hasta EF Core y SqlClient.
 */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Qué se supo de la sesión después de que el API aceptó las credenciales:
 * - confirmed: la cookie llegó y la sesión está cargada.
 * - rejected: el API respondió, pero sin sesión (el navegador no guardó la cookie).
 * - pending: no hubo respuesta a tiempo; la consulta sigue y actualiza la UI al llegar.
 * Nunca es un error de login: las credenciales ya fueron aceptadas.
 */
export type SessionCheck = 'confirmed' | 'rejected' | 'pending';

export interface LoginOutcome {
  response: LoginResponse;
  /** Solo cuando el API respondió AUTHENTICATED. */
  session: SessionCheck | null;
}

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

  /**
   * Sube con cada cambio de estado (login, logout, 401). Una respuesta de /session
   * pedida antes de ese cambio llega tarde y ya no puede sobrescribirlo.
   */
  private generation = 0;

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

    const generation = this.generation;

    return this.fetchSession().pipe(
      catchError(() => {
        // Sin respuesta del API la UI queda anónima, salvo que ya sepa algo más reciente.
        if (generation === this.generation && this.sessionState() === null) {
          this.sessionState.set(ANONYMOUS_SESSION);
        }

        return of(ANONYMOUS_SESSION);
      }),
      map(session => this.sessionState() ?? session)
    );
  }

  /**
   * Tras un login aceptado: consulta la sesión desde cero (la cookie es nueva, una
   * consulta anterior no la llevaba) y la clasifica sin fallar nunca. Si no responde
   * en `timeoutMs`, la consulta sigue en curso y actualiza la UI cuando llegue.
   */
  confirmSession(timeoutMs: number = AUTH_REQUEST_TIMEOUT_MS): Observable<SessionCheck> {
    if (!this.isBrowser) {
      return of('pending');
    }

    this.replaceState(null);

    return this.fetchSession().pipe(
      map(session => ((this.sessionState() ?? session).isAuthenticated ? 'confirmed' : 'rejected') as SessionCheck),
      timeout({ first: Math.max(timeoutMs, 0) }),
      catchError(() => of('pending' as const))
    );
  }

  /**
   * Correo y contraseña. Si el correo aún no está confirmado, el API envía un
   * código y responde VERIFICATION_REQUIRED sin abrir la sesión.
   */
  login(email: string, password: string): Observable<LoginOutcome> {
    const remaining = this.startBudget();

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      timeout({ first: AUTH_REQUEST_TIMEOUT_MS }),
      switchMap(response =>
        response.status === 'AUTHENTICATED'
          ? this.confirmSession(remaining()).pipe(map(session => ({ response, session })))
          : of({ response, session: null })
      )
    );
  }

  /** Primer ingreso: cambia la contraseña temporal por una propia y abre la sesión. */
  changeTemporaryPassword(email: string, temporaryPassword: string, newPassword: string): Observable<SessionCheck> {
    const remaining = this.startBudget();

    return this.http
      .post<LoginResponse>(`${this.apiUrl}/change-temporary-password`, { email, temporaryPassword, newPassword })
      .pipe(timeout({ first: AUTH_REQUEST_TIMEOUT_MS }), switchMap(() => this.confirmSession(remaining())));
  }

  /** Confirma el correo con el código recibido y abre la sesión. */
  verifyEmail(email: string, code: string): Observable<SessionCheck> {
    const remaining = this.startBudget();

    return this.http
      .post<LoginResponse>(`${this.apiUrl}/verify-email`, { email, code })
      .pipe(timeout({ first: AUTH_REQUEST_TIMEOUT_MS }), switchMap(() => this.confirmSession(remaining())));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, {}).pipe(
      catchError(() => of(undefined)),
      map(() => undefined),
      tap(() => this.replaceState(ANONYMOUS_SESSION))
    );
  }

  /** El backend respondió 401: la sesión ya no es válida. */
  markAnonymous(): void {
    this.replaceState(ANONYMOUS_SESSION);
  }

  /** Una sola consulta a /session a la vez; solo la de la generación vigente escribe el estado. */
  private fetchSession(): Observable<Session> {
    if (this.pending$) {
      return this.pending$;
    }

    const generation = this.generation;
    const request: Observable<Session> = this.http.get<Session>(`${this.apiUrl}/session`).pipe(
      tap(session => {
        if (generation === this.generation) {
          this.sessionState.set(session);
        }
      }),
      finalize(() => {
        if (this.pending$ === request) {
          this.pending$ = null;
        }
      }),
      // Sigue aunque quien la pidió deje de esperar: la respuesta tardía actualiza la UI.
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.pending$ = request;

    return request;
  }

  /** Cambia el estado y deja sin efecto cualquier consulta de sesión en curso. */
  private replaceState(state: Session | null): void {
    this.generation++;
    this.pending$ = null;
    this.sessionState.set(state);
  }

  /** Lo que queda de los 15 s desde que el usuario pulsó, para la consulta de sesión. */
  private startBudget(): () => number {
    const startedAt = Date.now();

    return () => AUTH_REQUEST_TIMEOUT_MS - (Date.now() - startedAt);
  }
}
