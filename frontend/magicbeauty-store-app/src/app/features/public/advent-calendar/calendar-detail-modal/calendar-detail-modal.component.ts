import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  viewChild
} from '@angular/core';
import { formatCop } from '../../../../shared/utils/currency';
import { CalendarStatus, CampaignCalendar, CampaignCondition } from '../advent-calendar.model';

const STATUS_LABELS: Record<CalendarStatus, { label: string; icon: string }> = {
  'sold-out': { label: 'Agotado', icon: 'pi-shopping-bag' },
  presale: { label: 'Preventa', icon: 'pi-clock' },
  'coming-soon': { label: 'Próximamente', icon: 'pi-calendar' }
};

/**
 * Detalle ampliado de un calendario de Adviento. Un solo componente sirve para los
 * cuatro: todo el contenido sale del calendario recibido.
 */
@Component({
  selector: 'app-calendar-detail-modal',
  imports: [CdkTrapFocus],
  templateUrl: './calendar-detail-modal.component.html',
  styleUrl: './calendar-detail-modal.component.scss',
  host: { '(document:keydown.escape)': 'close()' }
})
export class CalendarDetailModalComponent {
  readonly calendar = input.required<CampaignCalendar>();
  readonly startIndex = input(0);
  readonly conditions = input<readonly CampaignCondition[]>([]);
  readonly instagramUrl = input<string>();
  readonly closed = output<void>();

  readonly money = formatCop;
  readonly index = linkedSignal(() => this.startIndex());
  readonly detail = computed(() => this.calendar().detail);
  readonly status = computed(() => STATUS_LABELS[this.detail().status]);
  readonly hasPrices = computed(() => {
    const c = this.calendar();
    return c.retail !== undefined && c.deposit !== undefined;
  });
  readonly titleId = computed(() => 'calendar-detail-title-' + this.calendar().id);

  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  constructor() {
    // Bloquea el scroll de la landing mientras el modal está abierto (mismo patrón que el catálogo).
    const document = inject(DOCUMENT);
    const elements = [document.documentElement, document.body];
    const previous = elements.map(element => ({
      value: element.style.getPropertyValue('overflow'),
      priority: element.style.getPropertyPriority('overflow')
    }));
    elements.forEach(element => element.style.setProperty('overflow', 'hidden'));
    inject(DestroyRef).onDestroy(() => elements.forEach((element, i) => {
      const { value, priority } = previous[i];
      if (value) element.style.setProperty('overflow', value, priority);
      else element.style.removeProperty('overflow');
    }));

    afterNextRender(() => this.closeButton().nativeElement.focus({ preventScroll: true }));
  }

  select(index: number): void {
    const count = this.calendar().images.length;
    this.index.set(((index % count) + count) % count);
  }

  move(direction: number): void {
    this.select(this.index() + direction);
  }

  close(): void {
    this.closed.emit();
  }

  /** Solo cierra si el clic empezó y terminó en el fondo, no al arrastrar desde el contenido. */
  private pressedBackdrop = false;

  onBackdropDown(event: PointerEvent): void {
    this.pressedBackdrop = event.target === event.currentTarget;
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.pressedBackdrop && event.target === event.currentTarget) this.close();
    this.pressedBackdrop = false;
  }
}
