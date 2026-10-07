import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService, PrimeTemplate } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppUser } from '../../../shared/models/user.model';
import { EMAIL_PATTERN } from '../../../shared/utils/account-rules';

type AccessState = 'active' | 'pending' | 'expired';

/** Igual que el backend: sin espacios y en minúsculas. */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Administradores de la tienda. Un ADMIN crea otro ADMIN solo con el correo: el
 * sistema genera una contraseña temporal, la envía por correo y el nuevo usuario
 * elige la suya en su primer ingreso. Nadie más conoce la temporal.
 */
@Component({
  selector: 'app-admin-users',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    TableModule,
    PrimeTemplate,
    ButtonModule,
    ConfirmDialogModule,
    InputTextModule,
    TagModule,
    ToastModule,
    TooltipModule,
    PageHeaderComponent,
    LoaderComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent {
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly formBuilder = inject(FormBuilder);

  /** Correo de la sesión: a uno mismo no se le reenvía acceso desde aquí. */
  private readonly session = inject(AuthService).session;
  private readonly currentEmail = computed(() => this.session()?.displayName?.toLowerCase() ?? null);

  readonly users = signal<AppUser[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  /** Usuario al que se le está reenviando el acceso. */
  readonly resettingId = signal<number | null>(null);

  /** El correo se escribe dos veces: un error de tipeo mandaría el acceso a otra persona. */
  readonly form = this.formBuilder.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.maxLength(254), Validators.pattern(EMAIL_PATTERN)]],
      confirmEmail: ['', Validators.required]
    },
    {
      validators: group =>
        normalizeEmail(group.get('email')!.value) === normalizeEmail(group.get('confirmEmail')!.value)
          ? null
          : { emailMismatch: true }
    }
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.userService.getAll().subscribe({
      next: users => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la lista de usuarios.' });
      }
    });
  }

  accessState(user: AppUser): AccessState {
    if (!user.mustChangePassword) {
      return 'active';
    }

    const expiresAt = user.temporaryPasswordExpiresAt ? new Date(user.temporaryPasswordExpiresAt).getTime() : 0;

    return expiresAt > Date.now() ? 'pending' : 'expired';
  }

  isCurrentUser(user: AppUser): boolean {
    return user.email.toLowerCase() === this.currentEmail();
  }

  showError(control: 'email' | 'confirmEmail'): boolean {
    const field = this.form.controls[control];

    return field.invalid && (field.touched || field.dirty);
  }

  /** Solo cuando ya se escribió la confirmación, para no regañar antes de tiempo. */
  showMismatch(): boolean {
    const confirm = this.form.controls.confirmEmail;

    return this.form.hasError('emailMismatch') && !!confirm.value && (confirm.touched || confirm.dirty);
  }

  /** Antes de enviar, se muestra el correo en grande para revisarlo una última vez. */
  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const email = normalizeEmail(this.form.getRawValue().email);

    this.confirmationService.confirm({
      key: 'create-admin',
      header: 'Confirma el correo',
      message: email,
      icon: 'pi pi-envelope',
      acceptLabel: 'Sí, enviar acceso',
      rejectLabel: 'Corregir',
      acceptIcon: 'pi pi-send',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.create(email)
    });
  }

  private create(email: string): void {
    this.saving.set(true);

    this.userService.createAdmin({ email }).subscribe({
      next: user => {
        this.saving.set(false);
        this.form.reset();
        this.messageService.add({
          severity: 'success',
          summary: 'Administrador creado',
          detail: 'Enviamos una contraseña temporal a ' + user.email + '. La cambiará en su primer ingreso.',
          life: 6000
        });
        this.load();
      },
      error: (response: HttpErrorResponse) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo crear',
          detail: (response.error?.error as string | undefined) ?? 'Revisa el correo e inténtalo de nuevo.'
        });
      }
    });
  }

  confirmResetAccess(user: AppUser): void {
    this.confirmationService.confirm({
      header: 'Reenviar acceso',
      message:
        'Enviaremos una contraseña temporal nueva a ' + user.email +
        '. Su contraseña actual dejará de funcionar. ¿Continuar?',
      icon: 'pi pi-envelope',
      acceptLabel: 'Enviar',
      rejectLabel: 'Cancelar',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.resetAccess(user)
    });
  }

  private resetAccess(user: AppUser): void {
    this.resettingId.set(user.id);

    this.userService.resetAccess(user.id).subscribe({
      next: updated => {
        this.resettingId.set(null);
        this.users.update(list => list.map(item => (item.id === updated.id ? updated : item)));
        this.messageService.add({
          severity: 'success',
          summary: 'Acceso enviado',
          detail: updated.email + ' recibió una contraseña temporal nueva.'
        });
      },
      error: (response: HttpErrorResponse) => {
        this.resettingId.set(null);
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo enviar',
          detail: (response.error?.error as string | undefined) ?? 'Inténtalo de nuevo en un momento.'
        });
      }
    });
  }
}
