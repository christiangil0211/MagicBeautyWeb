import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { AccountPanelComponent } from './account-panel.component';

it.each([null, '//external.example', '/admin/products'])('opens the home after login unless a safe return URL is present: %s', async returnUrl => {
  TestBed.configureTestingModule({
    imports: [AccountPanelComponent],
    providers: [provideRouter([]), { provide: AuthService, useValue: {
      session: signal(null), canManageStore: signal(false), isAuthenticated: signal(false),
      login: () => of({ status: 'AUTHENTICATED' })
    } }]
  });
  const fixture = TestBed.createComponent(AccountPanelComponent);
  fixture.componentRef.setInput('returnUrl', returnUrl);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  fixture.componentInstance.email.set('test@example.invalid');
  fixture.componentInstance.password.set('test-password');
  fixture.componentInstance.submitCredentials();
  expect(navigate).toHaveBeenCalledWith(returnUrl === '/admin/products' ? returnUrl : '/inicio');
});
