import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, computed, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DialogModule } from 'primeng/dialog';

import { TraditionalCatalogService } from '../../../core/services/traditional-catalog.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PublicTraditionalCatalog } from '../../../shared/models/traditional-catalog.model';

/**
 * Misma forma que normaliza el API (CanvaEmbedUrl). Se vuelve a comprobar aquí
 * porque es lo único que se marca como confiable para un iframe.
 */
const CANVA_EMBED_URL = /^https:\/\/www\.canva\.com\/design\/[A-Za-z0-9_-]{1,100}(\/[A-Za-z0-9_-]{1,100})?\/view\?embed$/;

/** Enlaces para abrir en Canva: solo dominios de Canva, igual que valida el API. */
const CANVA_SHARE_URL = /^https:\/\/(www\.canva\.com|canva\.com|canva\.link)\//;

/** Enlace para abrir el catálogo en Canva, o null si no es de Canva. */
export function canvaOpenUrl(catalog: PublicTraditionalCatalog): string | null {
  return CANVA_SHARE_URL.test(catalog.canvaShareUrl ?? '') ? catalog.canvaShareUrl : null;
}

/**
 * Pestaña "Catálogo tradicional": los catálogos originales de Canva, con el
 * visor oficial de Canva insertado (navegación por páginas y pantalla
 * completa) y la descarga del PDF que se sube desde la administración.
 */
@Component({
  selector: 'app-traditional-catalogs',
  imports: [DialogModule, EmptyStateComponent, LoaderComponent],
  templateUrl: './traditional-catalogs.component.html',
  styleUrl: './traditional-catalogs.component.scss'
})
export class TraditionalCatalogsComponent {
  private readonly catalogService = inject(TraditionalCatalogService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');

  readonly catalogs = signal<PublicTraditionalCatalog[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  readonly selected = signal<PublicTraditionalCatalog | null>(null);
  readonly viewerOpen = signal(false);

  /** Null si la URL no es una inserción de Canva válida: nunca se inserta otra cosa. */
  readonly viewerUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.selected()?.canvaEmbedUrl ?? '';

    return CANVA_EMBED_URL.test(url) ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  readonly canFullscreen = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }

    this.canFullscreen.set(!!document.fullscreenEnabled);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.catalogService.getPublic().subscribe({
      next: catalogs => {
        this.catalogs.set(catalogs);
        this.loading.set(false);
      },
      error: () => {
        this.catalogs.set([]);
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  readonly openUrl = canvaOpenUrl;

  /** Se muestra dentro de la tienda solo si Canva lo permite; si no, se abre en Canva. */
  canPreview(catalog: PublicTraditionalCatalog): boolean {
    return catalog.canvaEmbeddable && CANVA_EMBED_URL.test(catalog.canvaEmbedUrl);
  }

  open(catalog: PublicTraditionalCatalog): void {
    if (!this.canPreview(catalog)) {
      const url = canvaOpenUrl(catalog);

      if (url) {
        globalThis.open?.(url, '_blank', 'noopener');
      }

      return;
    }

    this.selected.set(catalog);
    this.viewerOpen.set(true);
  }

  onViewerVisibleChange(visible: boolean): void {
    this.viewerOpen.set(visible);

    if (!visible) {
      this.selected.set(null);
    }
  }

  /** Además del botón del propio visor de Canva, para navegadores que lo permiten. */
  enterFullscreen(): void {
    this.frame()?.nativeElement.requestFullscreen?.().catch(() => undefined);
  }
}
