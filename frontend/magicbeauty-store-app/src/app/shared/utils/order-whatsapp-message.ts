import { STORE_CONTACT } from '../../core/constants/store-contact';
import { formatCop } from './currency';
import { OrderQuote } from './order-quote';

/**
 * Texto del pedido para WhatsApp. Solo incluye líneas que se pueden cotizar; las
 * que no tienen precio de este tipo se envían como "por confirmar" y no suman al
 * total. Ningún importe sale de otra cosa que no sea la cotización recibida.
 */
export function buildOrderWhatsappMessage(
  quote: OrderQuote,
  businessName: string = STORE_CONTACT.businessName
): string {
  const lines = quote.lines.filter(line => line.status === 'available');
  const parts: string[] = [`Hola, ${businessName}. Quiero enviar este pedido.`, '', `*${quote.label}*`, ''];

  lines.forEach((item, index) => {
    const { line } = item;
    const detail = [`Ref. ${line.reference}`];

    if (line.variantName) {
      detail.push(`Tono: ${line.variantName}`);
    }

    parts.push(`${index + 1}. ${line.name}`);
    parts.push(`   ${detail.join(' · ')}`);
    parts.push(
      item.unitPrice === null || item.subtotal === null
        ? `   ${line.quantity} × Precio por confirmar`
        : `   ${line.quantity} × ${formatCop(item.unitPrice)} = ${formatCop(item.subtotal)}`
    );
    parts.push('');
  });

  parts.push(`*Total estimado: ${formatCop(quote.total)}*`);

  if (quote.missingPriceCount > 0) {
    parts.push(
      quote.missingPriceCount === 1
        ? '1 producto tiene precio por confirmar y no está incluido en el total.'
        : `${quote.missingPriceCount} productos tienen precio por confirmar y no están incluidos en el total.`
    );
  }

  parts.push('', 'Entiendo que los precios y la disponibilidad están sujetos a confirmación.');

  return parts.join('\n');
}
