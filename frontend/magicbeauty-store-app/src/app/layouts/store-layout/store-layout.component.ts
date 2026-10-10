import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HomeComponent } from '../../features/public/home/home.component';

@Component({
  selector: 'app-store-layout',
  imports: [HomeComponent, RouterOutlet],
  template: '<app-home [bannerOnly]="true" /><div class="store-pages"><router-outlet /></div>',
  styles: [
    ':host { display: block; }',
    '.store-pages { max-width: calc(var(--mb-container) + var(--mb-gutter) * 2); margin: 0 auto; padding: 24px var(--mb-gutter) 56px; }',
    '@media (max-width: 640px) { .store-pages { padding: 20px 16px 36px; } }'
  ]
})
export class StoreLayoutComponent {}
