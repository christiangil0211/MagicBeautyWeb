/**
 * Banners del carrusel del inicio. Cada uno es una imagen completa (con su texto
 * dibujado); por eso el título va aparte en HTML (oculto en escritorio, visible en
 * móvil) y los botones dibujados se cubren con enlaces reales («zonas»).
 */
export interface HomeSlideLink {
  label: string;
  link: string;
}

/** Botón dibujado dentro de la imagen, en % del ancho y alto de la imagen. */
export interface HomeSlideHotspot extends HomeSlideLink {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HomeSlide {
  id: string;
  /** Nombre corto para el punto del carrusel («Ir al banner de …»). */
  name: string;
  title: string;
  image: string;
  width: number;
  height: number;
  alt: string;
  /** Toda la imagen enlaza aquí. Sin `link` ni `hotspots`, el banner solo informa. */
  link?: HomeSlideLink;
  hotspots?: readonly HomeSlideHotspot[];
  /** Aviso bajo la imagen: parte destacada + resto. */
  note?: { strong: string; text: string };
  /** Botones reales que reemplazan a los dibujados en móvil, donde la imagen queda pequeña. */
  mobileCtas?: readonly HomeSlideLink[];
}

export const HOME_SLIDES: readonly HomeSlide[] = [
  {
    id: 'calendars',
    name: 'calendarios',
    title: 'Calendarios de Adviento 2026',
    image: '/images/campaigns/banner-calendarios-2026.webp',
    width: 2172,
    height: 724,
    alt: 'Colección Calendarios de Adviento 2026: Trendy, Purpure, Bloomshell y Magic Beauty Cosmetics',
    link: { label: 'Explorar Calendarios de Adviento 2026. Trendy agotado; consulta las demás propuestas.', link: '/calendarios-de-adviento' },
    note: { strong: 'Trendy: agotado.', text: 'Consulta las demás propuestas. El empaque propio de Magic Beauty mostrado es conceptual.' },
    mobileCtas: [{ label: 'Explorar calendarios', link: '/calendarios-de-adviento' }]
  },
  {
    id: 'catalogs',
    name: 'catálogos',
    title: 'Tu belleza, también en grandes cantidades',
    image: '/images/campaigns/banner-catalogo-mayorista.webp',
    width: 2172,
    height: 724,
    alt: 'Hazte mayorista. Tu belleza, también en grandes cantidades: precios especiales, productos exclusivos y acompañamiento para hacer crecer tu negocio. Precios especiales, productos exclusivos y asesoría personalizada.',
    // Posición de los dos botones dibujados en la imagen (2172 × 724).
    hotspots: [
      { label: 'Ver catálogo digital', link: '/catalogo', left: 2.6, top: 80, width: 16.4, height: 11.6 },
      { label: 'Ver catálogo tradicional', link: '/catalogos', left: 19.6, top: 80, width: 19.2, height: 11.6 }
    ],
    mobileCtas: [
      { label: 'Ver catálogo digital', link: '/catalogo' },
      { label: 'Ver catálogo tradicional', link: '/catalogos' }
    ]
  },
  {
    id: 'store',
    name: 'la tienda',
    title: 'Todo para resaltar tu belleza',
    image: '/images/campaigns/banner-tienda-magic-beauty.webp',
    width: 2172,
    height: 724,
    alt: 'Magic Beauty Cosmetics, nuestra tienda: todo para resaltar tu belleza. Cuidado capilar, maquillaje, skincare y más, con las marcas que te encantan.',
    link: { label: 'Explorar productos en el catálogo digital', link: '/catalogo' },
    mobileCtas: [{ label: 'Explorar productos', link: '/catalogo' }]
  },
  {
    id: 'payments',
    name: 'medios de pago',
    title: 'Compra fácil y segura',
    image: '/images/campaigns/banner-medios-de-pago.webp',
    width: 2172,
    height: 724,
    // Banner informativo: no enlaza a ningún lado, así que el texto completo va en el alt.
    alt: 'Medios de pago. Compra fácil y segura: elige el método de pago que más te convenga. Tarjetas débito o crédito (Visa, Mastercard, American Express), transferencias bancarias y efectivo en tienda. Pagos verificados, compra confiable y atención personalizada.'
  }
];

/** Tiempo que se muestra cada banner antes de pasar al siguiente. */
export const HOME_SLIDE_INTERVAL_MS = 6500;
