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
 * Banner de cada página. Todas muestran el carrusel de campañas (home-slides.ts);
 * viaja como `data` de la ruta para que la página contenedora lo pinte. Con
 * `title`, la página lleva su propio h1 bajo el carrusel; sin él (el inicio), el
 * título del banner activo hace de h1.
 */
export interface PortalBanner {
  title?: string;
  /** Final del título, en fucsia. */
  highlight?: string;
  text?: string;
}

export const PORTAL_BANNERS = {
  // h1 fijo de la portada: no depende del banner que esté a la vista.
  benefits: {
    title: 'Maquillaje y cosméticos en Cali,',
    highlight: 'al detal y al por mayor',
    text: 'Las marcas que te encantan con precios especiales para tu negocio. Arma tu pedido y envíalo por WhatsApp.'
  },
  digitalCatalog: {
    title: 'Catálogo',
    highlight: 'mayorista',
    text: 'Encuentra fácilmente los productos que necesitas. Filtra, busca y consulta precios especiales para tu negocio.'
  },
  traditionalCatalogs: {
    title: 'Nuestros',
    highlight: 'catálogos',
    text: 'Explora nuestras líneas de productos en formato tradicional. Puedes verlos aquí mismo o descargarlos en PDF.'
  },
  order: {
    title: 'Mi pedido',
    highlight: 'siempre contigo',
    text: 'Revisa los productos que has agregado, ajusta cantidades y envía tu pedido por WhatsApp.'
  }
} satisfies Record<string, PortalBanner>;

/** Rutas que forman el portal: el ítem del menú se marca activo en todas ellas. */
export function isPortalUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0].replace(/^\/+/, '');
  const first = path.split('/')[0];

  return path === '' || first === 'catalogo' || first === 'catalogos' || first === 'pedido';
}
