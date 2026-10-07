export interface AppUser {
  id: number;
  email: string;
  emailConfirmed: boolean;
  /** Tiene una contraseña temporal que todavía no cambia. */
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt?: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  lastLoginAt?: string | null;
}

/** Solo el correo: el sistema genera la contraseña temporal y la envía. */
export interface CreateAdminUserRequest {
  email: string;
}
