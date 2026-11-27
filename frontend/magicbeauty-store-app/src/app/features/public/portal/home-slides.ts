import { PublicHomeBanner } from '../../../shared/models/home-banner.model';

/**
 * Banners del carrusel del inicio. Cada uno es una imagen completa (con su texto
 * dibujado); por eso el título va aparte en HTML (oculto en escritorio, visible en
 * móvil) y los botones dibujados se cubren con enlaces reales («zonas»).
 *
 * Los banners se administran en Admin › Banners del inicio (api/banners). Los de
 * HOME_SLIDES son el respaldo: van en el HTML prerenderizado y se usan si el API
 * falla o no tiene ninguno visible.
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
  /**
   * Temporada en la que el banner va primero y el carrusel arranca en él (fechas
   * de Colombia, inclusive, `AAAA-MM-DD`). Fuera de ella pasa al final.
   */
  featured?: { from: string; until: string };
  /**
   * Copias de la imagen para `srcset`, de menor a mayor (sin la original). Si no se
   * indican, se suponen `<nombre>-768.webp` y `<nombre>-1280.webp` junto a la original.
   */
  sources?: readonly { url: string; width: number }[];
}

/**
 * Tamaños del banner para `srcset`. Junto a cada imagen original (2172 px) hay
 * copias WebP de 768 y 1280 px (`<nombre>-768.webp`, `<nombre>-1280.webp`): el
 * celular descarga ~40 KB en vez de ~270 KB y la imagen principal carga antes.
 */
export const HOME_SLIDE_WIDTHS = [768, 1280] as const;

/** Ocupa todo el ancho de la pantalla hasta su tamaño real. */
export const HOME_SLIDE_SIZES = '(min-width: 2172px) 2172px, 100vw';

export function homeSlideSrcset(slide: Pick<HomeSlide, 'image' | 'width' | 'sources'>): string {
  if (slide.sources) {
    return [...slide.sources.map(source => `${source.url} ${source.width}w`), `${slide.image} ${slide.width}w`].join(', ');
  }

  const base = slide.image.replace(/\.(jpe?g|png|webp)$/i, '');

  return [...HOME_SLIDE_WIDTHS.map(width => `${base}-${width}.webp ${width}w`), `${slide.image} ${slide.width}w`].join(', ');
}

/**
 * Banner del API → diapositiva del carrusel. Solo se usan copias que existan;
 * sin copias, la original sirve para todos los tamaños.
 */
export function slideFromBanner(banner: PublicHomeBanner): HomeSlide {
  const sources = [
    { url: banner.imageUrl768, width: 768 },
    { url: banner.imageUrl1280, width: 1280 }
  ].filter((source): source is { url: string; width: number } => !!source.url && source.width < banner.imageWidth);

  return {
    id: `banner-${banner.id}`,
    name: banner.name,
    title: banner.title,
    image: banner.imageUrl ?? '',
    width: banner.imageWidth,
    height: banner.imageHeight,
    alt: banner.altText,
    link: banner.link ?? undefined,
    hotspots: banner.hotspots.length ? banner.hotspots : undefined,
    note: banner.noteHighlight || banner.noteText ? { strong: banner.noteHighlight ?? '', text: banner.noteText ?? '' } : undefined,
    mobileCtas: banner.mobileCtas.length ? banner.mobileCtas : undefined,
    sources
  };
}

/** Fecha de hoy en Colombia (`AAAA-MM-DD`), la que rige las temporadas. */
export function colombiaDate(now: Date): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Orden del carrusel para una fecha: primero los destacados en temporada, luego
 * los normales y al final los destacados fuera de temporada, cada grupo en el
 * orden del arreglo.
 */
export function orderHomeSlides(slides: readonly HomeSlide[], now: Date): readonly HomeSlide[] {
  const today = colombiaDate(now);
  const rank = (slide: HomeSlide) => {
    if (!slide.featured) return 1;
    return slide.featured.from <= today && today <= slide.featured.until ? 0 : 2;
  };

  return [...slides].sort((a, b) => rank(a) - rank(b));
}

export const HOME_SLIDES: readonly HomeSlide[] = [
  {
    id: 'calendars',
    name: 'calendarios',
    title: 'Calendario de Adviento Magic Beauty 2026',
    image: '/images/campaigns/banner-calendario-magic-beauty-2026.jpg',
    width: 2172,
    height: 724,
    alt: 'Edición especial 2026: Calendario de Adviento Magic Beauty. Arma el tuyo con nuestros productos y sorprende en esta Navidad. 100% personalizable, se adapta a tu presupuesto, un regalo único. Cotiza el tuyo.',
    link: { label: 'Cotiza tu Calendario de Adviento Magic Beauty 2026', link: '/calendarios-de-adviento' },
    note: { strong: 'Calendario Magic Beauty:', text: 'arma el tuyo a tu medida y según tu presupuesto.' },
    mobileCtas: [{ label: 'Cotiza el tuyo', link: '/calendarios-de-adviento' }],
    // Temporada de calendarios: va primero hasta Nochebuena.
    featured: { from: '2026-11-01', until: '2026-12-24' }
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
