import { Component, ElementRef, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { PortalBannerComponent } from '../../features/public/portal/portal-banner.component';
import { routeBanner } from '../../features/public/portal/portal-banner.service';

/**
 * Tienda con sesión (catálogo, categorías y detalle). Muestra el mismo banner que
 * la página equivalente del portal público, declarado en `data.portalBanner`.
 */
@Component({
  selector: 'app-store-layout',
  imports: [PortalBannerComponent, RouterOutlet],
  template:
    '<app-portal-banner [banner]="banner()" (contentRequested)="scrollToContent()" />' +
    '<div class="store-pages" #content><router-outlet /></div>',
  styles: [
    ':host { display: block; }',
    '.store-pages { max-width: calc(var(--mb-container) + var(--mb-gutter) * 2); margin: 0 auto; padding: 24px var(--mb-gutter) 56px; scroll-margin-top: 1rem; }',
    '@media (max-width: 640px) { .store-pages { padding: 20px 16px 36px; } }'
  ]
})
export class StoreLayoutComponent {
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  readonly banner = routeBanner();

  scrollToContent(): void {
    this.content()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
