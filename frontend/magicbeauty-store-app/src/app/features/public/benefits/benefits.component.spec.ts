import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { TraditionalCatalogService } from '../../../core/services/traditional-catalog.service';
import { BenefitsComponent } from './benefits.component';

async function setup(pdf: string | null) {
  TestBed.configureTestingModule({
    imports: [BenefitsComponent],
    providers: [provideRouter([]), { provide: TraditionalCatalogService, useValue: { getFeaturedPdfUrl: () => of(pdf) } }]
  });

  const fixture = TestBed.createComponent(BenefitsComponent);
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
}

const boxes = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('.download')).map(box => ({
    title: box.querySelector('h3')?.textContent?.trim(),
    button: box.querySelector('.download__button')?.textContent?.trim(),
    href: box.querySelector('.download__button')?.getAttribute('href')
  }));

it('ends with the PDF download and the digital catalog boxes', async () => {
  expect(boxes(await setup('https://cdn/catalogo.pdf'))).toEqual([
    { title: 'Descarga nuestro catálogo en PDF', button: 'Descargar PDF', href: 'https://cdn/catalogo.pdf' },
    { title: 'Explora nuestro catálogo digital', button: 'Ver catálogo digital', href: '/catalogo' }
  ]);
});

it('offers the traditional catalogs when there is no PDF yet', async () => {
  expect(boxes(await setup(null))[0]).toEqual({
    title: 'Descarga nuestro catálogo en PDF',
    button: 'Ver catálogos',
    href: '/catalogos'
  });
});

it('explains how to buy wholesale right before the PDF download', async () => {
  const element = await setup(null);
  const section = element.querySelector('app-how-to-buy') as HTMLElement;
  const text = (section.textContent ?? '').replace(/\s+/g, ' ');

  expect(text).toContain('¿Cómo comprar al por mayor?');
  expect(Array.from(section.querySelectorAll('.step h3')).map(step => step.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
    'Empieza con una compra de $100.000',
    'Arma tu pedido fácilmente',
    'Revisa y confirma tu compra',
    '¡Preparamos tu envío!'
  ]);
  expect(text).toContain('Envía o Inter Rapidísimo');
  expect(section.nextElementSibling?.querySelector('h3')?.textContent).toContain('Descarga nuestro catálogo en PDF');
});
