import { Component } from '@angular/core';
import { STORE_SOCIAL_LINKS, whatsappUrl } from '../../../core/constants/store-contact';

const IMAGES = '/images/campaigns/calendars';

/** Landing del Calendario de Adviento propio de Magic Beauty (los de otras marcas se agotaron). */
@Component({
  selector: 'app-advent-calendar',
  templateUrl: './advent-calendar.component.html',
  styleUrl: './advent-calendar.component.scss'
})
export class AdventCalendarComponent {
  readonly whatsapp = whatsappUrl(undefined, 'Hola, Magic Beauty Cosmetics. Quiero cotizar un Calendario de Adviento Magic Beauty personalizado. ¿Me ayudan a armarlo según mi presupuesto?');

  readonly images = {
    cover: `${IMAGES}/magic-beauty-portada.jpg`,
    boxes: `${IMAGES}/magic-beauty-cajitas.jpg`
  };

  readonly highlights = [
    { icon: 'pi-gift', text: '100% personalizable' },
    { icon: 'pi-sparkles', text: 'Se adapta a tu presupuesto' },
    { icon: 'pi-heart', text: 'Un regalo único y especial' }
  ];

  readonly features = [
    { icon: 'pi-gift', title: 'Personalízalo a tu medida', text: 'Tú eliges los productos que más te gusten de nuestro catálogo y lo armamos según lo que quieras invertir. ¡Hay opciones para todos los bolsillos!' },
    { icon: 'pi-box', title: 'Diseño exclusivo', text: 'Una presentación hermosa con 12 cajitas numeradas, ideal para regalar o consentirte.' },
    { icon: 'pi-star', title: 'Variedad y calidad', text: 'Incluye maquillaje, cuidado facial, accesorios y mucho más.' }
  ];

  readonly gallery = [
    { src: `${IMAGES}/magic-beauty-productos.jpg`, alt: 'Variedad de productos de Magic Beauty para armar el calendario: maquillaje, cuidado capilar, rubores, labiales y accesorios', width: 900, height: 1200 },
    { src: `${IMAGES}/magic-beauty-presentacion.jpg`, alt: 'Calendario de Adviento Magic Beauty con la portada de casita de dulces y los productos acomodados en su interior', width: 900, height: 1200 }
  ];

  readonly instagramUrl = STORE_SOCIAL_LINKS.find(link => link.name === 'Instagram')?.url;

  /** Canales del primer paso: cada ícono abre la conversación. */
  readonly contactLinks = [
    { icon: 'pi-whatsapp', label: 'Escríbenos por WhatsApp', url: this.whatsapp },
    ...(this.instagramUrl ? [{ icon: 'pi-instagram', label: 'Escríbenos por Instagram', url: this.instagramUrl }] : [])
  ];

  readonly steps = [
    { icon: 'pi-whatsapp', title: this.instagramUrl ? 'Escríbenos por WhatsApp o Instagram' : 'Escríbenos por WhatsApp', text: 'Cuéntanos para quién es y cuánto quieres invertir.', contact: true },
    { icon: 'pi-shopping-bag', title: 'Elige los productos', text: 'Te ayudamos a escogerlos de nuestro catálogo.' },
    { icon: 'pi-check-circle', title: 'Confirma tu pedido', text: 'Te enviamos la cotización y, al aprobarla, armamos tu calendario.' },
    { icon: 'pi-truck', title: 'Recíbelo', text: 'Recógelo en la tienda o pide el envío a domicilio.' }
  ];

  readonly questions = [
    { question: '¿Puedo elegir los productos?', answer: 'Sí. Armas el calendario con productos de nuestro catálogo: maquillaje, cuidado facial, accesorios y más. Si prefieres, te recomendamos una selección.' },
    { question: '¿Cuánto cuesta?', answer: 'Depende de los productos que elijas: lo armamos según tu presupuesto. Escríbenos por WhatsApp y te enviamos la cotización.' },
    { question: '¿Cuántas sorpresas trae?', answer: 'El calendario tiene 12 cajitas numeradas, de distintos tamaños, para descubrir una sorpresa en cada una.' },
    { question: '¿Puedo recogerlo en la tienda?', answer: 'Sí. Coordina con nuestro equipo el día de recogida cuando tu calendario esté listo.' },
    { question: '¿Hacen envíos?', answer: 'Sí. Consulta con nuestro equipo la cobertura, el costo y el plazo para tu destino antes de confirmar el pedido.' },
    { question: '¿Todavía hay calendarios de Trendy, Purpure o Bloomshell?', answer: 'No. Los calendarios de otras marcas se agotaron y por ahora no tenemos más unidades disponibles.' }
  ];
}
