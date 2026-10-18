import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';

import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { AuthService, SessionCheck } from '../../../core/services/auth.service';
import { EMAIL_PATTERN, PASSWORD_RULES } from '../../../shared/utils/account-rules';
import { authErrorMessage } from '../../../shared/utils/auth-errors';

/**
 * Si la base estaba en pausa, el API tarda más: el loader lo explica en lugar de
 * dejar al usuario frente a un "Iniciando sesión…" que no avanza. La espera nunca
 * pasa de AUTH_REQUEST_TIMEOUT_MS (15 s).
 */
export const AUTH_WAIT_MESSAGES = [
  { afterMs: 0, text: 'Iniciando sesión…' },
  { afterMs: 5_000, text: 'Está tardando un poco más de lo normal. Un momento, por favor…' }
] as const;

/** Las credenciales ya se aceptaron: ninguno de estos es un error de login. */
export const SESSION_MESSAGES = {
  pending: 'Iniciaste sesión, pero tu cuenta aún no termina de cargar. Espera unos segundos o pulsa «Cargar mi cuenta».',
  rejected: 'Tu navegador no conservó la sesión. Revisa que permita las cookies de este sitio e inténtalo de nuevo.'
} as const;

export interface AccountAdminLink {
  label: string;
  icon: string;
  path: string;
}

type LoginStep = 'credentials' | 'code' | 'new-password';

/**
 * Panel lateral de "Cuenta". Sin sesión: correo y contraseña y, si el correo aún
 * no está confirmado, el código que llega por correo. Con sesión: saludo,
 * accesos de administración (si el backend los autoriza) y salida.
 */
@Component({
  selector: 'app-account-panel',
  imports: [FormsModule, RouterLink, LoaderComponent],
  templateUrl: './account-panel.component.html',
  styleUrl: './account-panel.component.scss'
})
export class AccountPanelComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private waitTimers: ReturnType<typeof setTimeout>[] = [];

  readonly open = input(false);
  readonly adminLinks = input<AccountAdminLink[]>([]);
  /** A dónde volver tras iniciar sesión; lo indica el guard del administrador. */
  readonly returnUrl = input<string | null>(null);
  readonly closed = output<void>();

  readonly session = this.auth.session;
  readonly canManageStore = this.auth.canManageStore;
  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly step = signal<LoginStep>('credentials');
  readonly email = signal('');
  readonly password = signal('');
  readonly code = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly passwordRules = PASSWORD_RULES;

  /** La contraseña nueva cumple todo y coincide con la confirmación. */
  readonly newPasswordReady = computed(
    () =>
      this.passwordRules.every(rule => rule.test(this.newPassword())) &&
      this.newPassword().length <= 128 &&
      this.newPassword() === this.confirmPassword()
  );
  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly loaderMessage = signal<string>(AUTH_WAIT_MESSAGES[0].text);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);

  /** El API aceptó las credenciales pero la sesión aún no se pudo cargar. */
  readonly sessionPending = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.clearWaitTimers());

    // La consulta de sesión sigue tras el plazo: si llega tarde, el login termina solo,
    // sin otro POST.
    effect(() => {
      if (this.sessionPending() && this.isAuthenticated()) {
        untracked(() => this.finishLogin());
      }
    });
  }

  close(): void {
    this.resetForm();
    this.closed.emit();
  }

  submitCredentials(): void {
    const email = this.email().trim();
    const password = this.password();

    if (this.submitting()) {
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      this.error.set('Escribe un correo electrónico válido.');
      return;
    }

    if (!password) {
      this.error.set('Escribe tu contraseña.');
      return;
    }

    this.info.set(null);

    this.send(this.auth.login(email, password), 'No pudimos iniciar sesión. Inténtalo de nuevo.', outcome => {
      const response = outcome.response;

      if (response.status === 'VERIFICATION_REQUIRED') {
        this.step.set('code');
        this.code.set('');
        this.info.set('Te enviamos un código de 6 dígitos a ' + (response.email ?? email) + '.');
        return;
      }

      if (response.status === 'PASSWORD_CHANGE_REQUIRED') {
        // La temporal se conserva en memoria solo hasta completar el cambio.
        this.step.set('new-password');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.showPassword.set(false);
        return;
      }

      this.afterSessionCheck(outcome.session ?? 'pending');
    });
  }

  submitCode(): void {
    const code = this.code().trim();

    if (this.submitting()) {
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      this.error.set('El código tiene 6 dígitos.');
      return;
    }

    this.send(this.auth.verifyEmail(this.email().trim(), code), 'No pudimos verificar el código.', check =>
      this.afterSessionCheck(check)
    );
  }

  /** Primer ingreso con contraseña temporal: el usuario elige la suya y entra. */
  submitNewPassword(): void {
    if (this.submitting()) {
      return;
    }

    if (!this.newPasswordReady()) {
      this.error.set(
        this.newPassword() !== this.confirmPassword()
          ? 'Las contraseñas no coinciden.'
          : 'La contraseña aún no cumple todos los requisitos.'
      );
      return;
    }

    this.send(
      this.auth.changeTemporaryPassword(this.email().trim(), this.password(), this.newPassword()),
      'No pudimos guardar tu contraseña.',
      check => this.afterSessionCheck(check)
    );
  }

  newRuleMet(test: (value: string) => boolean): boolean {
    return test(this.newPassword());
  }

  /** Vuelve a validar la contraseña: el API reenvía un código si el anterior ya no sirve. */
  resendCode(): void {
    this.step.set('credentials');
    this.submitCredentials();
  }

  backToCredentials(): void {
    this.sessionPending.set(false);
    this.step.set('credentials');
    this.code.set('');
    this.password.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.error.set(null);
    this.info.set(null);
  }

  /** Solo vuelve a consultar la sesión (no consulta la base): nunca repite el POST de login. */
  retrySession(): void {
    if (this.submitting()) {
      return;
    }

    this.send(this.auth.confirmSession(), 'No pudimos cargar tu cuenta.', check => this.afterSessionCheck(check));
  }

  logout(): void {
    this.auth.logout().subscribe(() => {
      this.close();
      this.router.navigateByUrl('/');
    });
  }

  /**
   * Las credenciales ya se aceptaron. Solo una sesión confirmada cierra el panel; si
   * no llegó a tiempo se avisa sin error, y si el navegador no guardó la cookie se
   * explica, conservando lo escrito para volver a intentar.
   */
  private afterSessionCheck(check: SessionCheck): void {
    if (check === 'confirmed') {
      this.finishLogin();
      return;
    }

    if (check === 'pending') {
      this.password.set('');
      this.sessionPending.set(true);
      this.info.set(SESSION_MESSAGES.pending);
      return;
    }

    this.sessionPending.set(false);
    this.step.set('credentials');
    this.error.set(SESSION_MESSAGES.rejected);
  }

  private finishLogin(): void {
    const target = this.safeReturnUrl() ?? '/inicio';

    this.close();

    this.router.navigateByUrl(target);
  }

  /** La contraseña no se conserva más de lo necesario. */
  private resetForm(): void {
    this.step.set('credentials');
    this.password.set('');
    this.code.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.showPassword.set(false);
    this.sessionPending.set(false);
    this.error.set(null);
    this.info.set(null);
  }

  /**
   * Un envío a la vez: bloquea el formulario, muestra el loader con avisos si tarda
   * y lo libera siempre (respuesta, error, timeout o cierre del componente). Lo
   * escrito se conserva si falla; no se reintenta solo para no sumar intentos fallidos.
   */
  private send<T>(request: Observable<T>, fallback: string, onSuccess: (value: T) => void): void {
    this.submitting.set(true);
    this.error.set(null);
    this.startWaitMessages();

    request
      .pipe(
        finalize(() => this.stopWaiting()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: value => {
          this.stopWaiting();
          onSuccess(value);
        },
        error: (failure: unknown) => {
          this.stopWaiting();
          this.error.set(authErrorMessage(failure, fallback));
        }
      });
  }

  private startWaitMessages(): void {
    this.clearWaitTimers();
    this.loaderMessage.set(AUTH_WAIT_MESSAGES[0].text);
    this.waitTimers = AUTH_WAIT_MESSAGES.slice(1).map(stage =>
      setTimeout(() => this.loaderMessage.set(stage.text), stage.afterMs)
    );
  }

  private stopWaiting(): void {
    this.clearWaitTimers();
    this.submitting.set(false);
  }

  private clearWaitTimers(): void {
    this.waitTimers.forEach(timer => clearTimeout(timer));
    this.waitTimers = [];
  }

  /** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
  private safeReturnUrl(): string | null {
    const url = this.returnUrl();

    return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
  }
}
