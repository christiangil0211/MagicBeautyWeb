export interface PortalTab {
  label: string;
  /** Texto corto para la barra inferior en móvil. */
  shortLabel: string;
  icon: string;
  path: string;
  /** Solo activa con la URL exacta; si no, también en sus rutas hijas (detalle). */
  exact: boolean;
}

/** Pestañas del portal: la única experiencia comercial pública mientras no hay e-commerce. */
export const PORTAL_TABS: PortalTab[] = [
  { label: 'Beneficios', shortLabel: 'Beneficios', icon: 'pi pi-heart', path: '/', exact: true },
  { label: 'Catálogo digital', shortLabel: 'Catálogo', icon: 'pi pi-shopping-cart', path: '/catalogo', exact: false },
  { label: 'Catálogo tradicional', shortLabel: 'Catálogos', icon: 'pi pi-book', path: '/catalogos', exact: true },
  { label: 'Mi pedido', shortLabel: 'Mi pedido', icon: 'pi pi-shopping-bag', path: '/pedido', exact: true }
];

/** Cómo se nombra el portal dentro del menú del administrador (texto del mockup aprobado). */
export const PORTAL_MENU_LABEL = 'Hazte mayorista';

/**
 * Botón del banner: navega a otra pestaña (`link`) o baja al contenido de la
 * pestaña actual (sin `link`).
 */
export interface PortalBannerAction {
  label: string;
  icon: string;
  link?: string;
}

/**
 * Encabezado de cada pestaña, según los banners aprobados (1920 × 700). Viaja como
 * `data` de la ruta para que la página contenedora pinte el banner que toca.
 */
export interface PortalBanner {
  eyebrow?: string;
  title: string;
  /** Final del título, en fucsia y en su propia línea. */
  highlight?: string;
  text: string;
  /** Lado derecho del banner aprobado (sin textos), servido desde /public. */
  image: string;
  actions: PortalBannerAction[];
}

export const PORTAL_BANNERS = {
  benefits: {
    eyebrow: 'Hazte mayorista',
    title: 'Tu belleza, también en',
    highlight: 'grandes cantidades',
    text: 'Accede a precios especiales, productos exclusivos y un acompañamiento personalizado para hacer crecer tu negocio.',
    image: '/images/portal/banner-beneficios.jpg',
    actions: [
      { label: 'Ver catálogo digital', icon: 'pi pi-search', link: '/catalogo' },
      { label: 'Ver catálogo tradicional', icon: 'pi pi-book', link: '/catalogos' }
    ]
  },
  digitalCatalog: {
    title: 'Catálogo',
    highlight: 'mayorista',
    text: 'Encuentra fácilmente los productos que necesitas. Filtra, busca y consulta precios especiales para tu negocio.',
    image: '/images/portal/banner-catalogo-digital.jpg',
    actions: [{ label: 'Explorar catálogo digital', icon: 'pi pi-search' }]
  },
  traditionalCatalogs: {
    title: 'Nuestros',
    highlight: 'catálogos',
    text: 'Explora nuestras líneas de productos en formato tradicional. Puedes verlos aquí mismo o descargarlos en PDF.',
    image: '/images/portal/banner-catalogos.jpg',
    actions: [{ label: 'Ver catálogos', icon: 'pi pi-book' }]
  },
  order: {
    title: 'Mi pedido',
    highlight: 'siempre contigo',
    text: 'Revisa los productos que has agregado, ajusta cantidades y envía tu pedido por WhatsApp.',
    image: '/images/portal/banner-pedido.jpg',
    actions: [{ label: 'Revisar mi pedido', icon: 'pi pi-shopping-bag' }]
  }
} satisfies Record<string, PortalBanner>;

/** Rutas que forman el portal: el ítem del menú se marca activo en todas ellas. */
export function isPortalUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0].replace(/^\/+/, '');
  const first = path.split('/')[0];

  return path === '' || first === 'catalogo' || first === 'catalogos' || first === 'pedido';
}
