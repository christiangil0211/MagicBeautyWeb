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
  address: 'Calle 13 # 44A - 26, Cali',
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
