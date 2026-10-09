import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { AuthService } from '../../../core/services/auth.service';
import { EMAIL_PATTERN, PASSWORD_RULES } from '../../../shared/utils/account-rules';

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
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);

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

    this.submitting.set(true);
    this.error.set(null);
    this.info.set(null);

    this.auth.login(email, password).subscribe({
      next: response => {
        this.submitting.set(false);

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

        this.finishLogin();
      },
      error: (response: HttpErrorResponse) => {
        this.submitting.set(false);
        this.error.set(this.messageFrom(response, 'No pudimos iniciar sesión. Inténtalo de nuevo.'));
      }
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

    this.submitting.set(true);
    this.error.set(null);

    this.auth.verifyEmail(this.email().trim(), code).subscribe({
      next: () => {
        this.submitting.set(false);
        this.finishLogin();
      },
      error: (response: HttpErrorResponse) => {
        this.submitting.set(false);
        this.error.set(this.messageFrom(response, 'No pudimos verificar el código.'));
      }
    });
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

    this.submitting.set(true);
    this.error.set(null);

    this.auth
      .changeTemporaryPassword(this.email().trim(), this.password(), this.newPassword())
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.finishLogin();
        },
        error: (response: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(this.messageFrom(response, 'No pudimos guardar tu contraseña.'));
        }
      });
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
    this.step.set('credentials');
    this.code.set('');
    this.password.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.error.set(null);
    this.info.set(null);
  }

  logout(): void {
    this.auth.logout().subscribe(() => {
      this.close();
      this.router.navigateByUrl('/');
    });
  }

  private finishLogin(): void {
    const target = this.safeReturnUrl();

    this.close();

    if (target) {
      this.router.navigateByUrl(target);
    }
  }

  /** La contraseña no se conserva más de lo necesario. */
  private resetForm(): void {
    this.step.set('credentials');
    this.password.set('');
    this.code.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.showPassword.set(false);
    this.error.set(null);
    this.info.set(null);
  }

  private messageFrom(response: HttpErrorResponse, fallback: string): string {
    if (response.status === 429 && !response.error?.error) {
      return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
    }

    return (response.error?.error as string | undefined) ?? fallback;
  }

  /** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
  private safeReturnUrl(): string | null {
    const url = this.returnUrl();

    return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
  }
}
