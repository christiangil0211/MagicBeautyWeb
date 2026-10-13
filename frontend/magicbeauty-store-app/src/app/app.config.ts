import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { SeoTitleStrategy } from './core/seo/seo-title.strategy';
import { MagicBeautyPreset } from './core/theme/magic-beauty.preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Título, descripción, robots y canonical de cada ruta salen de un solo sitio.
    { provide: TitleStrategy, useExisting: SeoTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([credentialsInterceptor])),
    provideClientHydration(withEventReplay()),
    providePrimeNG({
      theme: {
        preset: MagicBeautyPreset,
        options: {
          darkModeSelector: false,
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng, app'
          }
        }
      },
      ripple: true
    })
  ]
};
