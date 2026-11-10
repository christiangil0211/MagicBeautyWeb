/** Estado comercial que se muestra en el detalle de cada calendario. */
export type CalendarStatus = 'sold-out' | 'presale' | 'coming-soon';

export interface CalendarFeature {
  icon: string;
  text: string;
  /** Texto en negrita antes de la descripción (p. ej. «Entrega estimada por la marca:»). */
  label?: string;
}

/** Información ampliada que solo se ve en el modal de detalle. */
export interface CalendarDetail {
  /** Línea superior con la marca, sobre el título. */
  brand: string;
  title: string;
  /** Parte del título resaltada en rosa. */
  highlight?: string;
  status: CalendarStatus;
  description: string;
  features: readonly CalendarFeature[];
  /** Texto del botón principal (WhatsApp o Instagram cuando está agotado). */
  ctaLabel: string;
}

export interface CampaignCalendar {
  id: string;
  name: string;
  images: readonly string[];
  soldOut?: boolean;
  retail?: number;
  deposit?: number;
  wholesale?: number;
  wholesaleDeposit?: number;
  wholesaleMinimum?: number;
  /** Texto corto de la tarjeta. */
  description: string;
  whatsapp: string;
  /** Las imágenes no son fotografías oficiales del producto. */
  conceptualImages?: boolean;
  detail: CalendarDetail;
}

export interface CampaignCondition {
  icon: string;
  title: string;
  description: string;
  text: string;
  notice?: string;
  closing?: string;
}
