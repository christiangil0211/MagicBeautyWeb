import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { PublicTraditionalCatalog } from '../../shared/models/traditional-catalog.model';
import { TraditionalCatalogService } from './traditional-catalog.service';

const PUBLIC = (url: string) => url.endsWith('/traditional-catalogs/public');

const catalog = (id: number, pdfUrl: string | null): PublicTraditionalCatalog => ({
  id,
  name: 'Catálogo ' + id,
  canvaEmbedUrl: '',
  canvaShareUrl: '',
  canvaEmbeddable: false,
  coverImageUrl: null,
  pdfUrl
});

describe('TraditionalCatalogService', () => {
  let service: TraditionalCatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TraditionalCatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('serves the featured PDF and the catalogs tab from a single request', () => {
    const featured = vi.fn();
    const list = vi.fn();

    // Inicio (Beneficios) y luego la pestaña de catálogos en la misma visita.
    service.getFeaturedPdfUrl().subscribe(featured);
    http.expectOne(r => PUBLIC(r.url)).flush([catalog(1, null), catalog(2, 'https://cdn/b.pdf')]);
    service.getPublic().subscribe(list);
    service.getPublic().subscribe(list);

    http.expectNone(r => PUBLIC(r.url));
    expect(featured).toHaveBeenCalledWith('https://cdn/b.pdf');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('asks again after a failure so "retry" really retries', () => {
    const featured = vi.fn();
    const error = vi.fn();

    service.getPublic().subscribe({ error });
    http.expectOne(r => PUBLIC(r.url)).flush(null, { status: 503, statusText: 'Service Unavailable' });
    expect(error).toHaveBeenCalledTimes(1);

    service.getFeaturedPdfUrl().subscribe(featured);
    http.expectOne(r => PUBLIC(r.url)).flush([catalog(1, 'https://cdn/a.pdf')]);
    expect(featured).toHaveBeenCalledWith('https://cdn/a.pdf');
  });

  it('keeps the featured PDF optional when the API fails', () => {
    const featured = vi.fn();

    service.getFeaturedPdfUrl().subscribe(featured);
    http.expectOne(r => PUBLIC(r.url)).flush(null, { status: 500, statusText: 'Server Error' });

    expect(featured).toHaveBeenCalledWith(null);
  });

  it('forgets the list after any change made from the administration', () => {
    service.getPublic().subscribe();
    http.expectOne(r => PUBLIC(r.url)).flush([catalog(1, null)]);

    service.update(1, {} as never).subscribe();
    http.expectOne(r => r.method === 'PUT').flush(null);

    service.getPublic().subscribe();
    http.expectOne(r => PUBLIC(r.url)).flush([catalog(1, 'https://cdn/a.pdf')]);
  });
});
