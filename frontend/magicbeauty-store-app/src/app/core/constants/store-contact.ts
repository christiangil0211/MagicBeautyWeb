/**
 * Datos de contacto de la tienda. Único lugar donde se define el WhatsApp:
 * los componentes lo leen de aquí en vez de repetir el número.
 */
export const STORE_CONTACT = {
  /** Número en formato internacional, solo dígitos, como lo espera wa.me. */
  whatsappPhone: '573011663303',
  whatsappMessage:
    'Hola, estoy visitando el catálogo de Magic Beauty Cosmetics y quisiera recibir asesoría.'
} as const;

export function whatsappUrl(
  phone: string = STORE_CONTACT.whatsappPhone,
  message: string = STORE_CONTACT.whatsappMessage
): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
