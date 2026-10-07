import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AppUser, CreateAdminUserRequest } from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/admin/users`;

  getAll(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(this.apiUrl);
  }

  /** Solo un ADMIN puede crear otro ADMIN; el API lo exige. */
  createAdmin(request: CreateAdminUserRequest): Observable<AppUser> {
    return this.http.post<AppUser>(this.apiUrl, request);
  }

  /** Reemplaza la contraseña por una temporal nueva y la envía al correo del usuario. */
  resetAccess(id: number): Observable<AppUser> {
    return this.http.post<AppUser>(`${this.apiUrl}/${id}/reset-access`, {});
  }
}
