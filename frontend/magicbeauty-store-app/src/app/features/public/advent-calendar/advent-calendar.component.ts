import { Component, signal } from '@angular/core';
import { STORE_SOCIAL_LINKS, whatsappUrl } from '../../../core/constants/store-contact';
import { formatCop } from '../../../shared/utils/currency';

import { CampaignCalendar, CampaignCondition } from './advent-calendar.model';
import { CalendarDetailModalComponent } from './calendar-detail-modal/calendar-detail-modal.component';
import { CampaignSocialFollowComponent } from './campaign-social-follow/campaign-social-follow.component';

@Component({
  selector: 'app-advent-calendar',
  imports: [CampaignSocialFollowComponent, CalendarDetailModalComponent],
  templateUrl: './advent-calendar.component.html',
  styleUrl: './advent-calendar.component.scss'
})
export class AdventCalendarComponent {
  readonly money = formatCop;
  readonly instagramUrl = STORE_SOCIAL_LINKS.find(link => link.name === 'Instagram')?.url;
  private readonly imageIndexes = signal<Record<string, number>>({});

  imageIndex(calendar: CampaignCalendar): number {
    return this.imageIndexes()[calendar.id] ?? 0;
  }

  selectImage(calendar: CampaignCalendar, index: number): void {
    const count = calendar.images.length;
    this.imageIndexes.update(current => ({ ...current, [calendar.id]: ((index % count) + count) % count }));
  }

  moveImage(calendar: CampaignCalendar, direction: number): void {
    this.selectImage(calendar, this.imageIndex(calendar) + direction);
  }

  /** Calendario abierto en el modal y el elemento que lo abrió (para devolverle el foco). */
  readonly selected = signal<{ calendar: CampaignCalendar; startIndex: number } | null>(null);
  private detailTrigger: HTMLElement | null = null;

  openDetail(calendar: CampaignCalendar, event: Event): void {
    this.detailTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.selected.set({ calendar, startIndex: this.imageIndex(calendar) });
  }

  closeDetail(): void {
    this.selected.set(null);
    this.detailTrigger?.focus({ preventScroll: true });
    this.detailTrigger = null;
  }

  readonly calendars: readonly CampaignCalendar[] = [
    { id: 'trendy', images: ["/images/campaigns/calendars/trendy-1.webp","/images/campaigns/calendars/trendy-2.webp","/images/campaigns/calendars/trendy-3.webp"], name: 'Trendy', soldOut: true,
      // Precios de la campaña: solo se muestran en el detalle como referencia; no hay nuevas separaciones.
      retail: 200000, deposit: 120000, wholesale: 180000, wholesaleDeposit: 100000, wholesaleMinimum: 3,
      description: 'Agotado. No se reciben nuevas separaciones para este calendario.', whatsapp: '',
      detail: {
        brand: 'Trendy', title: 'Wonderland Luxury', highlight: '2026', status: 'sold-out',
        description: 'Descubre una experiencia de belleza llena de sorpresas con 14 productos de maquillaje, skincare y accesorios, acompañados de un elegante baúl coleccionable color borgoña. Una edición especial para disfrutar, regalar y conservar.',
        features: [
          { icon: 'pi-gift', text: '14 productos sorpresa más el baúl coleccionable.' },
          { icon: 'pi-crown', text: 'Presentación premium.' },
          { icon: 'pi-box', text: 'Baúl reutilizable.' },
          { icon: 'pi-calendar', label: 'Entrega estimada por la marca:', text: '25 de noviembre al 15 de diciembre de 2026.' }
        ],
        ctaLabel: 'Síguenos para conocer novedades'
      } },
    { id: 'purpure', images: ["/images/campaigns/calendars/purpure-1.webp","/images/campaigns/calendars/purpure-2.webp","/images/campaigns/calendars/purpure-3.webp"], name: 'Purpure', retail: 140000, deposit: 100000, wholesale: 125000, wholesaleDeposit: 100000, wholesaleMinimum: 3,
      description: 'Consulta las condiciones de separación al detal y al por mayor.',
      whatsapp: whatsappUrl(undefined, 'Hola, Magic Beauty Cosmetics. Quiero solicitar la separación del Calendario de Adviento 2026 de Purpure. ¿Me comparten las condiciones al detal y mayorista (mínimo 3 unidades), el anticipo y cómo verificar el pago antes de confirmar la reserva?'),
      detail: {
        brand: 'Purpure', title: 'Calendario de Adviento', highlight: '2026', status: 'presale',
        description: 'Vive la emoción de descubrir una sorpresa de belleza con el calendario de Adviento Purpure. Su presentación navideña convierte cada apertura en un momento especial, ideal para consentirte o sorprender a alguien en diciembre.',
        features: [
          { icon: 'pi-gift', text: 'Una sorpresa de belleza en cada apertura.' },
          { icon: 'pi-star', text: 'Presentación navideña.' },
          { icon: 'pi-heart', text: 'Ideal para consentirte o regalar en diciembre.' },
          { icon: 'pi-info-circle', text: 'Contenido exacto pendiente de confirmación oficial.' }
        ],
        ctaLabel: 'Separar por WhatsApp'
      } },
    { id: 'bloomshell', images: ["/images/campaigns/calendars/bloomshell-1.webp","/images/campaigns/calendars/bloomshell-2.webp","/images/campaigns/calendars/bloomshell-3.webp"], name: 'Bloomshell', description: 'Muy pronto conocerás todos los detalles de este calendario.',
      whatsapp: whatsappUrl(undefined, 'Hola, Magic Beauty Cosmetics. Quisiera información sobre el lanzamiento del Calendario de Adviento 2026 de Bloomshell. Entiendo que el precio y las condiciones están pendientes de confirmación.'),
      detail: {
        brand: 'Bloomshell', title: 'Calendario de Adviento', highlight: '2026', status: 'coming-soon',
        description: 'La belleza también se vive con sorpresas. Bloomshell se suma a nuestra colección navideña con una propuesta especial de su universo de cosméticos. Muy pronto compartiremos los detalles de esta edición.',
        features: [
          { icon: 'pi-sparkles', text: 'Una propuesta especial del universo de cosméticos Bloomshell.' },
          { icon: 'pi-info-circle', text: 'Contenido, precio y separación pendientes de confirmación.' }
        ],
        ctaLabel: 'Consultar lanzamiento'
      } },
    { id: 'magic-beauty', images: ["/images/campaigns/calendars/magic-beauty-1.webp","/images/campaigns/calendars/magic-beauty-2.webp","/images/campaigns/calendars/magic-beauty-3.webp"], name: 'Magic Beauty Cosmetics', description: 'Nuestro calendario propio, con una propuesta pensada en distintos presupuestos.',
      whatsapp: whatsappUrl(undefined, 'Hola, Magic Beauty Cosmetics. Quisiera información sobre el lanzamiento de su Calendario de Adviento 2026 propio y la propuesta para distintos presupuestos. Entiendo que el precio y las condiciones están pendientes de confirmación.'),
      conceptualImages: true,
      detail: {
        brand: 'Magic Beauty Cosmetics', title: 'Nuestro calendario', highlight: 'especial', status: 'coming-soon',
        description: 'Queremos que la magia de diciembre esté al alcance de diferentes presupuestos. Por eso estamos preparando nuestra propia propuesta de calendario de Adviento, pensada para disfrutar sorpresas de belleza sin dejar de cuidar tu bolsillo.',
        features: [
          { icon: 'pi-wallet', text: 'Propuesta pensada para distintos presupuestos.' },
          { icon: 'pi-info-circle', text: 'Opciones y contenido en preparación.' },
          { icon: 'pi-image', text: 'Las imágenes representan una propuesta conceptual, no fotografías oficiales.' }
        ],
        ctaLabel: 'Consultar nuestro calendario'
      } }
  ];
  readonly steps = [
    { icon: 'pi-shopping-bag', title: 'Elige tu calendario', text: 'Escoge la opción que más se adapte a ti.' },
    { icon: 'pi-whatsapp', title: 'Solicita tu separación por WhatsApp', text: 'Escríbenos y cuéntanos qué calendario deseas.' },
    { icon: 'pi-credit-card', title: 'Realiza el anticipo indicado', text: 'Efectúa el pago de la separación según el calendario elegido.' },
    { icon: 'pi-check-circle', title: 'Recibe confirmación', text: 'Verificaremos el pago antes de confirmar tu separación. Luego te comunicaremos la disponibilidad.' }
  ];
  readonly conditions: readonly CampaignCondition[] = [
    { icon: 'pi-credit-card', title: 'Pago del saldo', description: 'Consulta el plazo y la forma de pago.', text: 'El saldo se paga en una sola transacción cuando Magic Beauty confirme la disponibilidad. Tienes 3 días calendario desde la notificación para pagarlo. No se permiten abonos adicionales. El vencimiento del plazo no implica la pérdida automática del anticipo.' },
    { icon: 'pi-truck', title: 'Entregas', description: 'Disponibilidad y fechas por confirmar.', text: 'La disponibilidad y la fecha estimada de entrega se comunicarán cuando estén confirmadas. No se anuncia una fecha de entrega hasta contar con esa confirmación.' },
    { icon: 'pi-shop', title: 'Recogida en tienda', description: 'Puedes elegir recogida presencial.', text: 'Se permite recogida en tienda. Coordina con nuestro equipo los detalles cuando se confirme la disponibilidad de tu calendario.' },
    { icon: 'pi-box', title: 'Envíos', description: 'También puedes solicitar envío a domicilio.', text: 'Se permite envío a domicilio. Consulta con nuestro equipo la cobertura, el costo y el plazo aplicables a tu destino antes de acordar el envío.' },
    { icon: 'pi-sync', title: 'Cancelaciones y devoluciones', description: 'Conoce las condiciones de tu separación.', text: 'Si Magic Beauty no consigue el calendario, devolverá el anticipo completo. Las cancelaciones voluntarias se evaluarán individualmente, respetando los derechos legales del consumidor.', notice: 'una vez realizada la separación, no se realizan devoluciones por cambios de opinión o arrepentimiento del comprador.', closing: 'El vencimiento del plazo de pago no provoca automáticamente la pérdida del anticipo.' }
  ];
}
