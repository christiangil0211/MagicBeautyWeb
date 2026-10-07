import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet
} from '@angular/router';

import { LoaderComponent } from './shared/components/loader/loader.component';

/** Si la navegación resuelve antes de esto, no se muestra el loader (evita parpadeos). */
const NAVIGATION_LOADER_DELAY_MS = 150;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  /**
   * Hay una navegación en curso que tarda: verificar la sesión del guard o
   * descargar el código de una página. Las cargas de datos de cada pantalla
   * muestran su propio loader.
   */
  protected readonly navigating = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      this.navigating.set(false);
    };

    inject(Router)
      .events.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(event => {
        if (event instanceof NavigationStart) {
          stop();
          timer = setTimeout(() => this.navigating.set(true), NAVIGATION_LOADER_DELAY_MS);
        } else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          stop();
        }
      });
  }
}
