import { LowerCasePipe, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, filter, map, of, switchMap, tap } from 'rxjs';

import { whatsappUrl } from '../../../core/constants/store-contact';
import { AuthService } from '../../../core/services/auth.service';
import { OrderAvailabilityService } from '../../../core/services/order-availability.service';
import { OrderDraftService } from '../../../core/services/order-draft.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { MAX_LINE_QUANTITY, orderLineKey } from '../../../shared/models/order-draft.model';
import { formatCop } from '../../../shared/utils/currency';
import {
  OrderLineAvailability,
  OrderQuote,
  QUOTE_KINDS,
  QuoteKind,
  QuoteLine,
  buildOrderQuote
} from '../../../shared/utils/order-quote';
import { buildOrderWhatsappMessage } from '../../../shared/utils/order-whatsapp-message';

type PricingState = 'loading' | 'ready' | 'error';

/**
 * Pestaña "Mi pedido". Un solo pedido con dos cotizaciones (detal y mayorista)
 * calculadas con los precios vigentes de la API: nunca con precios guardados en
 * el navegador. El total es estimado y se confirma por WhatsApp.
 */
@Component({
  selector: 'app-order',
  imports: [LowerCasePipe, RouterLink, EmptyStateComponent, LoaderComponent, ConfirmDialogModule],
  providers: [ConfirmationService],
  templateUrl: './order.component.html',
  styleUrl: './order.component.scss'
})
export class OrderComponent {
  private readonly orderDraft = inject(OrderDraftService);
  private readonly availabilityService = inject(OrderAvailabilityService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly lines = this.orderDraft.lines;
  readonly itemCount = this.orderDraft.itemCount;
  readonly isEmpty = this.orderDraft.isEmpty;

  readonly quoteKinds = (Object.keys(QUOTE_KINDS) as QuoteKind[]).map(kind => ({ kind, ...QUOTE_KINDS[kind] }));
  readonly quoteKind = signal<QuoteKind>('retail');

  readonly pricingState = signal<PricingState>('loading');
  private readonly availability = signal<Map<string, OrderLineAvailability> | null>(null);
  private readonly reload = signal(0);

  readonly quotes = computed<Record<QuoteKind, OrderQuote> | null>(() => {
    const availability = this.availability();

    if (!availability) {
      return null;
    }

    return {
      retail: buildOrderQuote(this.lines(), availability, 'retail'),
      wholesale: buildOrderQuote(this.lines(), availability, 'wholesale')
    };
  });

  readonly quote = computed(() => this.quotes()?.[this.quoteKind()] ?? null);

  readonly priceColumnLabel = computed(() => (this.quoteKind() === 'retail' ? 'Precio detal' : 'Precio mayorista'));

  /** Hay algo que cotizar y los precios son los vigentes. */
  readonly canSend = computed(() => {
    const quote = this.quote();

    return this.pricingState() === 'ready' && !!quote && quote.pricedCount + quote.missingPriceCount > 0;
  });

  readonly whatsappHref = computed(() => {
    const quote = this.quote();

    return this.canSend() && quote ? whatsappUrl(undefined, buildOrderWhatsappMessage(quote)) : null;
  });

  readonly maxQuantity = MAX_LINE_QUANTITY;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }

    // Qué productos hay (no cuántos): cambiar cantidades no vuelve a consultar la API.
    const identity = computed(() =>
      this.lines()
        .map(line => orderLineKey(line))
        .sort()
        .join(',')
    );

    // Los precios visibles dependen de la sesión: al ingresar o salir se recalculan.
    const auth = inject(AuthService);
    const sessionKey = computed(() => {
      const session = auth.session();

      return session ? `${session.isAuthenticated}:${session.displayName ?? ''}` : 'pending';
    });

    combineLatest([toObservable(identity), toObservable(sessionKey), toObservable(this.reload)])
      .pipe(
        // Hasta saber quién navega no se consulta: si no, al llegar la sesión se
        // cancelaba la primera consulta (el API la veía como petición abortada).
        filter(([, session]) => session !== 'pending'),
        debounceTime(50),
        map(([lines, session, attempt]) => `${lines}|${session}|${attempt}`),
        distinctUntilChanged(),
        tap(() => this.pricingState.set('loading')),
        switchMap(() =>
          this.availabilityService.load(this.lines()).pipe(
            map(availability => ({ availability, failed: false })),
            catchError(() => of({ availability: null, failed: true }))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ availability, failed }) => {
        // Con error no se reutilizan precios viejos: mejor no cotizar que cotizar mal.
        this.availability.set(availability);
        this.pricingState.set(failed ? 'error' : 'ready');
      });
  }

  retry(): void {
    this.reload.update(value => value + 1);
  }

  selectQuote(kind: QuoteKind): void {
    this.quoteKind.set(kind);
  }

  increase(item: QuoteLine): void {
    this.orderDraft.setQuantity(item.key, Math.min(item.line.quantity + 1, this.maxFor(item)));
  }

  decrease(item: QuoteLine): void {
    this.orderDraft.setQuantity(item.key, item.line.quantity - 1);
  }

  /** Escritura directa: entre 1 y el tope técnico; las existencias no limitan la cotización. */
  setQuantity(item: QuoteLine, value: string, input: HTMLInputElement): void {
    const parsed = Number.parseInt(value, 10);
    const quantity = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), this.maxFor(item)) : item.line.quantity;

    this.orderDraft.setQuantity(item.key, quantity);
    input.value = String(quantity);
  }

  remove(item: QuoteLine): void {
    this.orderDraft.remove(item.key);
  }

  confirmClear(): void {
    this.confirmationService.confirm({
      header: 'Vaciar pedido',
      message: 'Se quitarán todos los productos de tu pedido.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Vaciar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.orderDraft.clear()
    });
  }

  maxFor(item: QuoteLine): number {
    return item.status === 'available' ? this.maxQuantity : item.line.quantity;
  }

  money(amount: number): string {
    return formatCop(amount);
  }
}
