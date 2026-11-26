import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { timeout } from 'rxjs';

import {
  STORE_ADDRESS,
  STORE_CONTACT,
  STORE_GEO,
  STORE_OPENING_HOURS,
  whatsappDisplayPhone,
  whatsappUrl
} from '../../../core/constants/store-contact';
import { AuthService } from '../../../core/services/auth.service';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryTile } from '../../../shared/models/category.model';
import { WHOLESALE_PATH } from '../portal/portal-navigation';
import { HomeFallbackComponent } from './home-fallback.component';
import { HomeFavoritesComponent } from './home-favorites.component';
import { HOME_API_TIMEOUT_MS, HomeSectionState } from './home-sections';

/** "Compra por categoría" muestra como máximo una fila de 8. */
const HOME_CATEGORIES_MAX = 8;

/** Casillas de carga de la sección de categorías (reservan su alto). */
const CATEGORY_SKELETONS = Array.from({ length: 6 }, (_, index) => index);

/** 20:00 → "8:00 p. m.", como se lee en Colombia. */
function formatHour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'a. m.' : 'p. m.';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/**
 * Inicio de la tienda (`/`), para visitantes y para quien tiene sesión. El
 * carrusel de campañas y el h1 los pinta el portal (data.portalBanner); aquí van
 * las secciones comerciales. Lo que depende del API se pide solo en el navegador:
 * el HTML prerenderizado lleva lo fijo (tienda física, mayoristas, beneficios) y
 * reserva el alto de lo que llega después para no desplazar la página.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, ToastModule, HomeFavoritesComponent, HomeFallbackComponent],
  providers: [MessageService],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  /** Las pistas de administración solo se muestran a quien puede administrar. */
  readonly canManageStore = inject(AuthService).canManageStore;

  readonly tiles = signal<CategoryTile[]>([]);
  readonly visibleTiles = computed(() => this.tiles().slice(0, HOME_CATEGORIES_MAX));
  readonly categorySkeletons = CATEGORY_SKELETONS;

  /**
   * La sección nunca colapsa: si el API falla, tarda o no hay categorías
   * destacadas, conserva su alto y muestra el respaldo (sin salto de página).
   */
  readonly categoryState = signal<HomeSectionState>('loading');

  readonly wholesalePath = WHOLESALE_PATH;
  readonly address = `${STORE_ADDRESS.streetAddress}, ${STORE_ADDRESS.locality}, ${STORE_ADDRESS.region}`;
  readonly mapsUrl = STORE_CONTACT.mapsUrl;
  readonly whatsappHref = whatsappUrl();
  readonly whatsappPhone = whatsappDisplayPhone();
  readonly hours = STORE_OPENING_HOURS.map(slot => `${formatHour(slot.opens)} a ${formatHour(slot.closes)}`);

  /** "Cómo llegar": Google Maps abre la ruta hasta el pin de la tienda. */
  readonly directionsUrl = STORE_GEO
    ? `https://www.google.com/maps/dir/?api=1&destination=${STORE_GEO.latitude},${STORE_GEO.longitude}`
    : STORE_CONTACT.mapsUrl;

  /** Mapa embebido sin API key (no tiene costo); el iframe carga diferido. */
  readonly mapEmbedUrl = inject(DomSanitizer).bypassSecurityTrustResourceUrl(
    STORE_GEO
      ? `https://maps.google.com/maps?q=${STORE_GEO.latitude},${STORE_GEO.longitude}&z=17&hl=es&output=embed`
      : `https://maps.google.com/maps?q=${encodeURIComponent(this.address)}&z=17&hl=es&output=embed`
  );

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }

    inject(CategoryService)
      .getHomeTiles()
      .pipe(timeout({ first: HOME_API_TIMEOUT_MS }))
      .subscribe({
        next: tiles => {
          this.tiles.set(tiles);
          this.categoryState.set(tiles.length > 0 ? 'ready' : 'fallback');
        },
        error: () => this.categoryState.set('fallback')
      });
  }

  categoryPath(slug: string): string {
    return '/catalogo/categoria/' + slug;
  }
}
