import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { OrderAvailabilityService } from '../../../core/services/order-availability.service';
import { OrderDraftService } from '../../../core/services/order-draft.service';
import { OrderLineAvailability } from '../../../shared/utils/order-quote';
import { OrderComponent } from './order.component';

const lipstick = {
  productId: 1, reference: 'ACO011', name: 'Labial mate', brandName: 'Milagros', imageUrl: null, variantId: null, variantName: null
};
const blush = { ...lipstick, productId: 2, reference: 'RUB002', name: 'Rubor' };

const availability = new Map<string, OrderLineAvailability>([
  ['1:0', {
    status: 'available',
    prices: [
      { priceTypeCode: 'WHOLESALE', priceTypeName: 'Por mayor', amount: 18000 },
      { priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 25000 }
    ]
  }],
  ['2:0', { status: 'available', prices: [{ priceTypeCode: 'RETAIL', priceTypeName: 'Detal', amount: 9000 }] }]
]);

async function setup(load: () => Observable<Map<string, OrderLineAvailability>> = () => of(availability)) {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [OrderComponent],
    providers: [
      provideRouter([]),
      { provide: OrderAvailabilityService, useValue: { load } },
      { provide: AuthService, useValue: { session: signal({ isAuthenticated: false, canManageStore: false }) } }
    ]
  });

  const order = TestBed.inject(OrderDraftService);
  const fixture = TestBed.createComponent(OrderComponent);
  await fixture.whenStable();
  order.add(lipstick, 2);
  order.add(blush, 1);
  // La consulta de precios espera un debounce: se aguarda a que termine, no un tiempo fijo.
  for (let attempt = 0; attempt < 100 && fixture.componentInstance.pricingState() === 'loading'; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  await fixture.whenStable();

  return { fixture, order, text: () => (fixture.nativeElement.textContent as string).replace(/ /g, ' ') };
}

it('shows the retail quote and switches to the wholesale quote over the same order', async () => {
  const { fixture, text } = await setup();

  expect(text()).toContain('$ 59.000');
  expect(fixture.componentInstance.quote()?.total).toBe(59000);

  fixture.componentInstance.selectQuote('wholesale');
  await fixture.whenStable();

  expect(fixture.componentInstance.quote()?.total).toBe(36000);
  expect(text()).toContain('Por confirmar');
  expect(text()).toContain('1 producto no tiene precio para esta cotización');
});

it('updates both quotes when a quantity changes', async () => {
  const { fixture, order } = await setup();

  order.setQuantity('1:0', 3);
  await fixture.whenStable();

  expect(fixture.componentInstance.quotes()?.retail.total).toBe(84000);
  expect(fixture.componentInstance.quotes()?.wholesale.total).toBe(54000);
});

it('sends the selected quote to the official WhatsApp number', async () => {
  const { fixture } = await setup();
  fixture.componentInstance.selectQuote('wholesale');
  await fixture.whenStable();

  const link = fixture.nativeElement.querySelector('a.send') as HTMLAnchorElement;
  const url = new URL(link.href);
  const message = url.searchParams.get('text')!.replace(/ /g, ' ');

  expect(url.origin + url.pathname).toBe('https://wa.me/573127381185');
  expect(message).toContain('*Cotización mayorista*');
  expect(message).toContain('2 × $ 18.000 = $ 36.000');
  expect(message).toContain('*Total estimado: $ 36.000*');
  expect(link.textContent).toContain('Enviar pedido por WhatsApp');
  expect(fixture.nativeElement.textContent).toContain('Precio mayorista');
});

it('does not offer to send when current prices cannot be loaded', async () => {
  const { fixture, text } = await setup(() => throwError(() => new Error('offline')));

  expect(fixture.componentInstance.canSend()).toBe(false);
  expect(fixture.nativeElement.querySelector('a.send')).toBeNull();
  expect(text()).toContain('No pudimos consultar los precios vigentes');
});

it('waits for the session before pricing so no request is cancelled when it arrives', async () => {
  localStorage.clear();
  const session = signal<{ isAuthenticated: boolean; canManageStore: boolean } | null>(null);
  const log: string[] = [];

  TestBed.configureTestingModule({
    imports: [OrderComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { session } },
      { provide: OrderAvailabilityService, useValue: { load: () => new Observable<Map<string, OrderLineAvailability>>(subscriber => {
        log.push('request');
        const timer = setTimeout(() => { subscriber.next(availability); subscriber.complete(); }, 100);
        return () => { clearTimeout(timer); if (!subscriber.closed) { log.push('cancelled'); } };
      }) } }
    ]
  });

  TestBed.inject(OrderDraftService).add(lipstick, 1);
  const fixture = TestBed.createComponent(OrderComponent);
  await fixture.whenStable();
  await new Promise(resolve => setTimeout(resolve, 80));

  // Todavía sin sesión: no se ha consultado nada.
  expect(log).toEqual([]);

  session.set({ isAuthenticated: true, canManageStore: true });
  for (let attempt = 0; attempt < 50 && fixture.componentInstance.pricingState() !== 'ready'; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  expect(log).toEqual(['request']);
  expect(fixture.componentInstance.pricingState()).toBe('ready');
});
