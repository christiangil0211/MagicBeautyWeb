import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TraditionalCatalogService } from '../../../core/services/traditional-catalog.service';
import { HowToBuyComponent } from './how-to-buy/how-to-buy.component';

interface Benefit {
  icon: string;
  title: string;
  text: string;
}

/**
 * Pestaña "Beneficios". El encabezado lo pinta el portal (banner); aquí van las
 * ventajas y la descarga del catálogo, con los textos del mockup aprobado.
 */
@Component({
  selector: 'app-benefits',
  imports: [RouterLink, HowToBuyComponent],
  templateUrl: './benefits.component.html',
  styleUrl: './benefits.component.scss'
})
export class BenefitsComponent {
  readonly benefits: Benefit[] = [
    {
      icon: 'pi pi-tag',
      title: 'Precios especiales',
      text: 'Accede a tarifas mayoristas y aumenta tu rentabilidad.'
    },
    {
      icon: 'pi pi-box',
      title: 'Amplio portafolio',
      text: 'Las mejores marcas y productos de tendencia.'
    },
    {
      icon: 'pi pi-user',
      title: 'Atención personalizada',
      text: 'Te acompañamos en todo el proceso.'
    },
    {
      icon: 'pi pi-truck',
      title: 'Envíos a toda Colombia',
      text: 'Llevamos tu pedido donde lo necesites.'
    }
  ];

  /** El mismo PDF del banner; sin PDF publicado se ofrece ver los catálogos. */
  readonly featuredPdf = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      inject(TraditionalCatalogService)
        .getFeaturedPdfUrl()
        .subscribe(url => this.featuredPdf.set(url));
    }
  }
}
