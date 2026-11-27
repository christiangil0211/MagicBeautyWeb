/** Enlace a una página de la tienda (ruta interna que empieza por «/»). */
export interface HomeBannerLink {
  label: string;
  link: string;
}

/** Zona clicable sobre un botón dibujado, en % del ancho y alto de la imagen. */
export interface HomeBannerHotspot extends HomeBannerLink {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Banner del carrusel tal como lo recibe la tienda (api/banners). */
export interface PublicHomeBanner {
  id: number;
  name: string;
  title: string;
  altText: string;
  imageUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  imageUrl768: string | null;
  imageUrl1280: string | null;
  link: HomeBannerLink | null;
  hotspots: HomeBannerHotspot[];
  mobileCtas: HomeBannerLink[];
  noteHighlight: string | null;
  noteText: string | null;
}

/** Banner en el administrador (api/home-banners). */
export interface HomeBanner extends PublicHomeBanner {
  /** Fechas de Colombia, `AAAA-MM-DD`, inclusive. */
  startsOn: string | null;
  endsOn: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Si hoy aparece en la tienda (activo, con imagen y vigente). */
  isVisibleToday: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveHomeBannerRequest {
  name: string;
  title: string;
  altText: string;
  link: HomeBannerLink | null;
  hotspots: HomeBannerHotspot[];
  mobileCtas: HomeBannerLink[];
  noteHighlight: string | null;
  noteText: string | null;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
}
