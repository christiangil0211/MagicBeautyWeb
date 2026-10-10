import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { orderLineKey } from '../../shared/models/order-draft.model';
import { ORDER_STORAGE_KEY, OrderDraftService, parseStoredOrder } from './order-draft.service';

const lipstick = {
  productId: 1, reference: 'ACO011', name: 'Labial', brandName: 'Milagros', imageUrl: null, variantId: null, variantName: null
};
const shade = { ...lipstick, productId: 2, reference: 'SOM002', name: 'Sombra', variantId: 21, variantName: 'Nude' };

function createService(platform = 'browser'): OrderDraftService {
  TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  const service = TestBed.inject(OrderDraftService);
  TestBed.tick();

  return service;
}

describe('OrderDraftService', () => {
  beforeEach(() => localStorage.clear());

  it('adds products and shades as separate lines and accumulates quantities', () => {
    const service = createService();

    service.add(lipstick, 2);
    service.add(shade);
    service.add(lipstick, 3);

    expect(service.lines().map(line => [orderLineKey(line), line.quantity])).toEqual([['1:0', 5], ['2:21', 1]]);
    expect(service.itemCount()).toBe(6);
  });

  it('updates, removes and clears lines and keeps them in localStorage', () => {
    const service = createService();

    service.add(lipstick);
    service.add(shade);
    service.setQuantity('2:21', 4);
    service.remove('1:0');

    const stored = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY)!);
    expect(stored.version).toBe(1);
    expect(stored.lines).toEqual([{ ...shade, quantity: 4 }]);

    service.clear();
    expect(service.isEmpty()).toBe(true);
    expect(localStorage.getItem(ORDER_STORAGE_KEY)).toBeNull();
  });

  it('restores the order after a reload', () => {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, lines: [{ ...shade, quantity: 3 }] }));

    const service = createService();

    expect(service.lines()).toEqual([{ ...shade, quantity: 3 }]);
  });

  it('never touches localStorage on the server', () => {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, lines: [{ ...shade, quantity: 3 }] }));

    const service = createService('server');
    service.add(lipstick);

    expect(service.lines().length).toBe(1);
    expect(JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY)!).lines[0].reference).toBe('SOM002');
  });

  it('keeps quantities between 1 and 999', () => {
    const service = createService();

    service.add(lipstick, 0);
    expect(service.lines()[0].quantity).toBe(1);

    service.setQuantity('1:0', 5000);
    expect(service.lines()[0].quantity).toBe(999);
  });
});

describe('parseStoredOrder', () => {
  it('drops malformed or tampered lines and ignores injected prices', () => {
    const lines = parseStoredOrder(JSON.stringify({
      version: 1,
      lines: [
        { ...lipstick, quantity: 2, unitPrice: 1, total: 1 },
        { ...lipstick, quantity: 7 },
        { ...shade, variantId: 'x' },
        { productId: -1, reference: 'X', name: 'X' },
        'basura'
      ]
    }));

    expect(lines).toEqual([{ ...lipstick, quantity: 2 }]);
  });

  it('discards unknown versions and invalid JSON safely', () => {
    expect(parseStoredOrder(JSON.stringify({ version: 2, lines: [{ ...lipstick, quantity: 1 }] }))).toEqual([]);
    expect(parseStoredOrder(null)).toEqual([]);
    expect(() => parseStoredOrder('{')).toThrow();
  });
});
