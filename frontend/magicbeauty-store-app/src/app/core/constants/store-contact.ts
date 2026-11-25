/** Dominio canónico del sitio, sin barra final. Lo usan canonical, Open Graph y datos estructurados. */
export const STORE_SITE_URL = 'https://www.magicbeautycosmetics.com';

/**
 * Dirección del local por partes, como la pide Schema.org. Solo datos
 * confirmados: no hay código postal publicado.
 */
export const STORE_ADDRESS = {
  streetAddress: 'Calle 13 # 44A - 26',
  locality: 'Cali',
  region: 'Valle del Cauca',
  countryCode: 'CO'
} as const;

/**
 * Horario confirmado, en hora de Colombia: lunes a sábado de 10:00 a 20:00.
 * El domingo no figura porque está cerrado (Schema.org: día ausente = cerrado).
 */
export const STORE_OPENING_HOURS = [
  {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: '10:00',
    closes: '20:00'
  }
] as const;

/**
 * PENDIENTE: coordenadas exactas del local (Calle 13 # 44A - 26, Cali), en grados
 * decimales, p. ej. `{ latitude: 3.4xxxxx, longitude: -76.5xxxxx }`. Mientras sea
 * `null`, el dato estructurado no publica `geo`: unas coordenadas aproximadas
 * podrían ubicar mal la tienda en Google.
 */
export const STORE_GEO: { latitude: number; longitude: number } | null = null;

/**
 * Datos de contacto de la tienda. Único lugar donde se define el WhatsApp:
 * los componentes lo leen de aquí en vez de repetir el número.
 */
export const STORE_CONTACT = {
  businessName: 'Magic Beauty Cosmetics',
  /** Número en formato internacional, solo dígitos, como lo espera wa.me. */
  whatsappPhone: '573127381185',
  whatsappMessage:
    'Hola, estoy visitando el catálogo de Magic Beauty Cosmetics y quisiera recibir asesoría.',
  email: 'magicbeauty0615@gmail.com',
  address: `${STORE_ADDRESS.streetAddress}, ${STORE_ADDRESS.locality}`,
  mapsUrl: 'https://maps.app.goo.gl/y5GSuFcaVCW9nVCi8'
} as const;

export interface StoreSocialLink {
  name: string;
  icon: string;
  url: string;
}

/** Redes sociales oficiales (pie de página). */
export const STORE_SOCIAL_LINKS: readonly StoreSocialLink[] = [
  { name: 'Instagram', icon: 'pi pi-instagram', url: 'https://www.instagram.com/magicbeautycosmeticscali' },
  { name: 'TikTok', icon: 'pi pi-tiktok', url: 'https://www.tiktok.com/@magicbeautycosmeticscali' },
  { name: 'Facebook', icon: 'pi pi-facebook', url: 'https://www.facebook.com/share/1JfkRgWHcT/' }
];

export function whatsappUrl(
  phone: string = STORE_CONTACT.whatsappPhone,
  message: string = STORE_CONTACT.whatsappMessage
): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** El número oficial en formato legible: 573127381185 → +57 312 738 1185. */
export function whatsappDisplayPhone(phone: string = STORE_CONTACT.whatsappPhone): string {
  const match = /^(\d{2})(\d{3})(\d{3})(\d{4})$/.exec(phone);

  return match ? `+${match[1]} ${match[2]} ${match[3]} ${match[4]}` : `+${phone}`;
}
