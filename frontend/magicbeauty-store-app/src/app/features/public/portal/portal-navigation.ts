export interface PortalTab {
  label: string;
  /** Texto corto para la barra inferior en móvil. */
  shortLabel: string;
  icon: string;
  path: string;
  /** Solo activa con la URL exacta; si no, también en sus rutas hijas (detalle). */
  exact: boolean;
}

/** Ruta de la página para mayoristas (antes era la portada). */
export const WHOLESALE_PATH = '/mayoristas';

/** Pestañas del portal: la única experiencia comercial pública mientras no hay e-commerce. */
export const PORTAL_TABS: PortalTab[] = [
  { label: 'Inicio', shortLabel: 'Inicio', icon: 'pi pi-home', path: '/', exact: true },
  { label: 'Catálogo digital', shortLabel: 'Catálogo', icon: 'pi pi-shopping-cart', path: '/catalogo', exact: false },
  { label: 'Catálogo tradicional', shortLabel: 'Catálogos', icon: 'pi pi-book', path: '/catalogos', exact: true },
  { label: 'Mayoristas', shortLabel: 'Mayoristas', icon: 'pi pi-briefcase', path: WHOLESALE_PATH, exact: true },
  { label: 'Mi pedido', shortLabel: 'Mi pedido', icon: 'pi pi-shopping-bag', path: '/pedido', exact: true }
];

/** Cómo se nombra la página de mayoristas en el menú superior (texto del mockup aprobado). */
export const PORTAL_MENU_LABEL = 'Hazte mayorista';

/**
 * Banner de cada página. Todas muestran el carrusel de campañas (home-slides.ts);
 * viaja como `data` de la ruta para que la página contenedora lo pinte. El
 * `title` es el h1 de la página, fijo bajo el carrusel: nunca depende del banner
 * que esté a la vista (los títulos de los banners van como texto).
 */
export interface PortalBanner {
  title: string;
  /** Final del título, en fucsia. */
  highlight?: string;
  text?: string;
}

export const PORTAL_BANNERS = {
  home: {
    title: 'Tienda de maquillaje y cosméticos',
    highlight: 'en Cali',
    text: 'Maquillaje, skincare, cuidado capilar y corporal de las marcas que te encantan. Compra al detal o al por mayor y arma tu pedido por WhatsApp.'
  },
  wholesale: {
    title: 'Maquillaje y cosméticos al por mayor',
    highlight: 'en Cali',
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
