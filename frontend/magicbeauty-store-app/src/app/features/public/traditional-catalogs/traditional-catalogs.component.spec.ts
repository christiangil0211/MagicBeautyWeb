import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TraditionalCatalogService } from '../../../core/services/traditional-catalog.service';
import { PublicTraditionalCatalog } from '../../../shared/models/traditional-catalog.model';
import { TraditionalCatalogsComponent, canvaOpenUrl } from './traditional-catalogs.component';

const catalogs: PublicTraditionalCatalog[] = [
  {
    id: 1,
    name: 'Línea facial',
    canvaEmbedUrl: 'https://www.canva.com/design/DAG6ebkid4Y/XQiyMidwSjjG8l9Pu16Lrw/view?embed',
    canvaShareUrl: 'https://canva.link/linea-facial-mayoristas-magic',
    canvaEmbeddable: true,
    coverImageUrl: 'https://cdn/cover.png',
    pdfUrl: 'https://cdn/facial.pdf'
  },
  {
    id: 2,
    name: 'Privado',
    canvaEmbedUrl: 'https://www.canva.com/design/DAFprivate/view?embed',
    canvaShareUrl: 'https://www.canva.com/design/DAFprivate/edit',
    canvaEmbeddable: false,
    coverImageUrl: null,
    pdfUrl: null
  }
];

async function setup() {
  TestBed.configureTestingModule({
    imports: [TraditionalCatalogsComponent],
    providers: [{ provide: TraditionalCatalogService, useValue: { getPublic: () => of(catalogs) } }]
  });

  const fixture = TestBed.createComponent(TraditionalCatalogsComponent);
  await fixture.whenStable();

  return fixture;
}

it('lists every active catalog with a PDF download only when there is a PDF', async () => {
  const fixture = await setup();
  const cards = fixture.nativeElement.querySelectorAll('.catalog-card') as NodeListOf<HTMLElement>;

  expect(cards.length).toBe(2);
  expect(cards[0].querySelector('a[download]')?.getAttribute('href')).toBe('https://cdn/facial.pdf');
  expect(cards[1].querySelector('a[download]')).toBeNull();
});

it('previews in the page when Canva allows it and otherwise links straight to Canva', async () => {
  const fixture = await setup();
  const cards = fixture.nativeElement.querySelectorAll('.catalog-card') as NodeListOf<HTMLElement>;

  // Insertable: botón que abre el visor.
  expect(cards[0].querySelector('button.mb-btn')?.textContent).toContain('Ver catálogo');

  // No insertable: enlace a Canva en una pestaña nueva.
  const link = cards[1].querySelector('.catalog-card__actions a') as HTMLAnchorElement;
  expect(link.textContent).toContain('Ver catálogo');
  expect(link.getAttribute('href')).toBe('https://www.canva.com/design/DAFprivate/edit');
  expect(link.getAttribute('target')).toBe('_blank');

  fixture.componentInstance.open(catalogs[0]);
  expect(fixture.componentInstance.viewerOpen()).toBe(true);
  expect(fixture.componentInstance.viewerUrl()).not.toBeNull();
});

it('opens Canva in a new tab instead of the viewer when the design cannot be embedded', async () => {
  const fixture = await setup();
  const opened: unknown[][] = [];
  const original = globalThis.open;
  globalThis.open = ((...args: unknown[]) => {
    opened.push(args);
    return null;
  }) as typeof globalThis.open;

  try {
    fixture.componentInstance.open(catalogs[1]);
  } finally {
    globalThis.open = original;
  }

  expect(fixture.componentInstance.viewerOpen()).toBe(false);
  expect(opened).toEqual([['https://www.canva.com/design/DAFprivate/edit', '_blank', 'noopener']]);
});

it('embeds and links only Canva domains', async () => {
  const fixture = await setup();
  const component = fixture.componentInstance;

  component.open({ ...catalogs[0], canvaEmbedUrl: 'https://evil.example/design/x/view?embed' });
  expect(component.viewerUrl()).toBeNull();

  expect(canvaOpenUrl({ ...catalogs[0], canvaShareUrl: 'javascript:alert(1)' })).toBeNull();
  expect(canvaOpenUrl({ ...catalogs[0], canvaShareUrl: 'https://canva.link.evil.example/x' })).toBeNull();
  expect(canvaOpenUrl(catalogs[0])).toBe('https://canva.link/linea-facial-mayoristas-magic');
});
