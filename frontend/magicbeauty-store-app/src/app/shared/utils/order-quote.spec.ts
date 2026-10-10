import { OrderDraftLine } from '../models/order-draft.model';
import { CatalogProductListItem, ProductDetail } from '../models/product.model';
import { buildOrderQuote, resolveOrderAvailability } from './order-quote';
import { buildOrderWhatsappMessage } from './order-whatsapp-message';

const line = (overrides: Partial<OrderDraftLine>): OrderDraftLine => ({
  productId: 1,
  reference: 'ACO011',
  name: 'Labial mate',
  brandName: 'Milagros',
  imageUrl: null,
  variantId: null,
  variantName: null,
  quantity: 1,
  ...overrides
});

// Los precios llegan deliberadamente en orden inverso: el cálculo no depende de la posición.
const products: CatalogProductListItem[] = [
  {
    id: 1, reference: 'ACO011', name: 'Labial mate', brandName: 'Milagros', hasVariants: false, availableQuantity: 5, categoryIds: [],
    prices: [
      { priceTypeCode: 'WHOLESALE', priceTypeName: 'Por mayor', amount: 18000 },
      { priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 25000 }
    ]
  },
  {
    id: 2, reference: 'SOM002', name: 'Sombra', brandName: 'Milagros', hasVariants: true, availableQuantity: 3, categoryIds: [],
    prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 12500 }]
  },
  {
    id: 3, reference: 'AGO003', name: 'Rubor agotado', brandName: 'Otra', hasVariants: false, availableQuantity: 0, categoryIds: [],
    prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 9000 }]
  }
];

const details = new Map<string, ProductDetail | null>([
  ['SOM002', {
    id: 2, reference: 'SOM002', name: 'Sombra', brandName: 'Milagros', prices: [], hasVariants: true, availableQuantity: 3,
    categories: [], images: [],
    variants: [{ id: 21, name: 'Nude', quantity: 3, displayOrder: 1 }, { id: 22, name: 'Coral', quantity: 0, displayOrder: 2 }]
  }]
]);

const order = [
  line({ quantity: 2 }),
  line({ productId: 2, reference: 'SOM002', name: 'Sombra', variantId: 21, variantName: 'Nude', quantity: 4 }),
  line({ productId: 2, reference: 'SOM002', name: 'Sombra', variantId: 22, variantName: 'Coral' }),
  line({ productId: 2, reference: 'SOM002', name: 'Sombra', variantId: 99, variantName: 'Retirado' }),
  line({ productId: 3, reference: 'AGO003', name: 'Rubor agotado' }),
  line({ productId: 404, reference: 'OFF404', name: 'Desactivado' })
];

describe('order quotes', () => {
  const availability = resolveOrderAvailability(order, products, details);

  it('quotes products without stock and leaves out only what is no longer in the catalog', () => {
    // Sin existencias (tono Coral, Rubor agotado) igual se cotiza: la disponibilidad la confirma el equipo.
    expect([...availability.values()].map(item => item.status)).toEqual([
      'available', 'available', 'available', 'unavailable', 'available', 'unavailable'
    ]);
  });

  it('prices the retail quote only with RETAIL prices', () => {
    const quote = buildOrderQuote(order, availability, 'retail');

    expect(quote.lines.map(item => item.unitPrice)).toEqual([25000, 12500, 12500, null, 9000, null]);
    expect(quote.lines.map(item => item.subtotal)).toEqual([50000, 50000, 12500, null, 9000, null]);
    expect(quote.total).toBe(121500);
    expect(quote.pricedCount).toBe(4);
    expect(quote.missingPriceCount).toBe(0);
    expect(quote.excludedCount).toBe(2);
  });

  it('prices the wholesale quote only with WHOLESALE prices and never invents a missing one', () => {
    const quote = buildOrderQuote(order, availability, 'wholesale');

    expect(quote.lines[0].unitPrice).toBe(18000);
    expect(quote.lines[1].unitPrice).toBeNull();
    expect(quote.total).toBe(36000);
    expect(quote.missingPriceCount).toBe(3);
  });

  it('marks a product that now has shades as unavailable without a shade', () => {
    const result = resolveOrderAvailability([line({ productId: 2, reference: 'SOM002' })], products, details);

    expect([...result.values()][0].status).toBe('unavailable');
  });

  it('builds the WhatsApp message from the quote without invented amounts', () => {
    const message = buildOrderWhatsappMessage(buildOrderQuote(order, availability, 'wholesale'), 'Magic Beauty Cosmetics');
    const normalized = message.replace(/ /g, ' ');

    expect(normalized).toContain('Hola, Magic Beauty Cosmetics.');
    expect(normalized).toContain('*Cotización mayorista*');
    expect(normalized).toContain('1. Labial mate\n   Ref. ACO011\n   2 × $ 18.000 = $ 36.000');
    expect(normalized).toContain('2. Sombra\n   Ref. SOM002 · Tono: Nude\n   4 × Precio por confirmar');
    expect(normalized).toContain('Tono: Coral');
    expect(normalized).toContain('Rubor agotado');
    expect(normalized).toContain('*Total estimado: $ 36.000*');
    expect(normalized).toContain('3 productos tienen precio por confirmar y no están incluidos en el total.');
    expect(normalized).not.toContain('Desactivado');
    expect(normalized).not.toContain('Retirado');
  });
});
