import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

import { PRIVACY_POLICY_VERSION } from '../../../shared/models/registration.model';

@Component({
  selector: 'app-privacy-policy',
  template: `
    <article class="policy">
      <h1>Política de Tratamiento de Datos Personales</h1>
      <p>Versión {{ version }}</p>
      @if (lines(); as document) {
        @for (line of document; track $index) {
          @if (line.startsWith('## ')) {
            <h2>{{ line.slice(3) }}</h2>
          } @else if (line.trim()) {
            <p>{{ line }}</p>
          }
        }
      } @else if (lines() === null) {
        <p role="alert">La política no está disponible en este momento.</p>
      } @else {
        <p role="status">Cargando la política…</p>
      }
    </article>
  `,
  styles: '.policy { max-width: 50rem; margin-inline: auto; padding: 2rem 1rem; }'
})
export class PrivacyPolicyComponent {
  readonly version = PRIVACY_POLICY_VERSION;
  readonly lines = toSignal(inject(HttpClient).get('/politica-de-datos.md', { responseType: 'text' }).pipe(
    map(text => text.split(/\r?\n/)),
    catchError(() => of(null))
  ));
}
