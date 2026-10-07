import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Mismo formato que valida el backend (EmailRules). La prueba real es el código enviado. */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export interface PasswordRule {
  label: string;
  test: (value: string) => boolean;
}

/**
 * Copia visual de PasswordPolicy del backend, para guiar mientras se escribe.
 * La validación que cuenta es la del API.
 */
export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Al menos 8 caracteres', test: value => value.length >= 8 },
  { label: 'Una mayúscula', test: value => /\p{Lu}/u.test(value) },
  { label: 'Una minúscula', test: value => /\p{Ll}/u.test(value) },
  { label: 'Un número', test: value => /\d/.test(value) },
  { label: 'Un símbolo', test: value => /[^\p{L}\d]/u.test(value) },
  { label: 'Sin espacios', test: value => value.length > 0 && !/\s/.test(value) }
];

export const passwordPolicyValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = (control.value as string | null) ?? '';

  return PASSWORD_RULES.every(rule => rule.test(value)) && value.length <= 128
    ? null
    : { passwordPolicy: true };
};
