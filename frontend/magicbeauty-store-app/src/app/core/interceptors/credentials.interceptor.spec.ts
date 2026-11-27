import { HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { credentialsInterceptor } from './credentials.interceptor';

it('strips credentials from an API request when rendering on the server', () => {
  TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
  const request = new HttpRequest('GET', `${environment.apiBaseUrl}/catalog/products`, {
    withCredentials: true,
    headers: new HttpHeaders({ Cookie: 'MagicBeauty.Session=private', Authorization: 'Bearer private' })
  });
  const downstream = vi.fn((_request: HttpRequest<unknown>) => of(new HttpResponse()));

  TestBed.runInInjectionContext(() => credentialsInterceptor(request, downstream)).subscribe();

  const forwarded = downstream.mock.calls[0][0];
  expect(forwarded.credentials).toBe('omit');
  expect(forwarded.withCredentials).toBe(false);
  expect(forwarded.headers.has('Cookie')).toBe(false);
  expect(forwarded.headers.has('Authorization')).toBe(false);
});
