import { LowerCasePipe, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { EMPTY, catchError, map, of, switchMap, timer } from 'rxjs';

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
  QuoteLine,
  buildOrderQuote,
  getOrderQuoteTypes
} from '../../../shared/utils/order-quote';
import { buildOrderWhatsappMessage } from '../../../shared/utils/order-whatsapp-message';

type PricingState = 'loading' | 'ready' | 'error';

interface PricingResult {
  key: string;
  availability: ReadonlyMap<string, OrderLineAvailability> | null;
}

/**
 * Calcula las cotizaciones del pedido con las tarifas visibles de la sesión.
 * El borrador conserva los productos y los importes se confirman por WhatsApp.
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
  private readonly auth = inject(AuthService);

  readonly lines = this.orderDraft.lines;
  readonly itemCount = this.orderDraft.itemCount;
  readonly isEmpty = this.orderDraft.isEmpty;

  private readonly selectedPriceTypeCode = signal<string | null>(null);
  private readonly result = signal<PricingResult | null>(null);
  private readonly reload = signal(0);
  private readonly productKeys = computed(() => this.lines().map(orderLineKey).sort().join(','));
  private readonly requestKey = computed(() => {
    const products = this.productKeys();
    if (!products || this.auth.session() === null) return null;

    return JSON.stringify([this.auth.priceAudienceKey(), products, this.reload()]);
  });

  // La clave se comprueba al leer para ocultar una cotización anterior antes de que se cancele su petición.
  private readonly currentResult = computed(() => {
    const result = this.result();
    return result?.key === this.requestKey() ? result : null;
  });

  readonly pricingState = computed<PricingState>(() => {
    const result = this.currentResult();
    return result === null ? 'loading' : result.availability ? 'ready' : 'error';
  });

  readonly quotes = computed<OrderQuote[]>(() => {
    const availability = this.currentResult()?.availability;
    return availability ? getOrderQuoteTypes(availability).map(type => buildOrderQuote(this.lines(), availability, type)) : [];
  });

  readonly quote = computed(() => {
    const availability = this.currentResult()?.availability;
    if (!availability) return null;

    const quotes = this.quotes();
    return quotes.find(quote => quote.priceTypeCode === this.selectedPriceTypeCode())
      ?? quotes[0]
      ?? buildOrderQuote(this.lines(), availability, null);
  });

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

    toObservable(this.requestKey)
      .pipe(
        switchMap(key => {
          if (key === null) return EMPTY;

          const lines = this.lines();
          return timer(50).pipe(
            switchMap(() => this.availabilityService.load(lines)),
            map(availability => ({ key, availability })),
            catchError(() => of({ key, availability: null }))
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe(result => {
        if (result.key !== this.requestKey()) return;

        this.result.set(result);
        if (result.availability) {
          this.selectedPriceTypeCode.set(this.quote()?.priceTypeCode ?? null);
        }
      });
  }

  retry(): void {
    this.reload.update(value => value + 1);
  }

  selectQuote(code: string | null): void {
    if (this.quotes().some(quote => quote.priceTypeCode === code)) {
      this.selectedPriceTypeCode.set(code);
    }
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
