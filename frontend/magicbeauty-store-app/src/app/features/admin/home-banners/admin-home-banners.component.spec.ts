import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { HomeBannerService } from '../../../core/services/home-banner.service';
import { HomeBanner } from '../../../shared/models/home-banner.model';
import { HOME_SLIDES } from '../../public/portal/home-slides';
import { AdminHomeBannersComponent, INTERNAL_PATH, bannerStatus } from './admin-home-banners.component';
import { bannerImageProblem } from './banner-image';
import { buildBannerPrompt } from './banner-prompt';

const banner = (id: number, changes: Partial<HomeBanner> = {}): HomeBanner => ({
  id,
  name: `banner ${id}`,
  title: `Título ${id}`,
  altText: `Alt ${id}`,
  imageUrl: `https://blob/home-banners/${id}/a.webp`,
  imageWidth: 2172,
  imageHeight: 724,
  imageUrl768: null,
  imageUrl1280: null,
  link: null,
  hotspots: [],
  mobileCtas: [],
  noteHighlight: null,
  noteText: null,
  startsOn: null,
  endsOn: null,
  sortOrder: id,
  isActive: true,
  isVisibleToday: true,
  createdAt: '',
  updatedAt: '',
  ...changes
});

describe('bannerStatus', () => {
  const today = '2026-12-10';

  it('explains why a banner is or is not on the store today', () => {
    expect(bannerStatus(banner(1, { imageUrl: null }), today).label).toBe('Sin imagen');
    expect(bannerStatus(banner(1, { isActive: false }), today).label).toBe('Inactivo');
    expect(bannerStatus(banner(1, { startsOn: '2026-12-15' }), today).label).toBe('Desde el 15/12');
    expect(bannerStatus(banner(1, { endsOn: '2026-12-09' }), today).label).toBe('Vencido');
    expect(bannerStatus(banner(1, { endsOn: '2026-12-24' }), today).label).toBe('Visible hasta el 24/12');
    expect(bannerStatus(banner(1), today)).toEqual({ label: 'Visible', severity: 'success' });
  });
});

describe('INTERNAL_PATH', () => {
  it.each(['/', '/catalogo', '/catalogo?categoria=labiales', '/calendarios-de-adviento#cotizar'])('accepts %s', path => {
    expect(INTERNAL_PATH.test(path)).toBe(true);
  });

  it.each(['https://otro.com', '//otro.com', 'catalogo', 'javascript:alert(1)', '/a b'])('rejects %s', path => {
    expect(INTERNAL_PATH.test(path)).toBe(false);
  });
});

describe('bannerImageProblem', () => {
  const jpg = { type: 'image/jpeg', size: 400_000 };

  it('accepts 3:1 images like the API', () => {
    expect(bannerImageProblem(jpg, 2172, 724)).toBeNull();
    expect(bannerImageProblem(jpg, 2000, 671)).toBeNull();
  });

  it('explains what is wrong', () => {
    expect(bannerImageProblem({ type: 'image/gif', size: 1 }, 2172, 724)).toContain('JPG, PNG o WebP');
    expect(bannerImageProblem({ type: 'image/png', size: 4 * 1024 * 1024 }, 2172, 724)).toContain('3 MB');
    expect(bannerImageProblem(jpg, 1920, 1080)).toContain('3 veces más ancha');
    expect(bannerImageProblem(jpg, 1200, 400)).toContain('entre 1600 y 4400');
  });
});

describe('buildBannerPrompt', () => {
  const base = {
    mode: 'full' as const,
    theme: 'Navidad',
    headline: 'Regala belleza',
    subtitle: 'Kits listos',
    buttons: ['Ver regalos', 'Cotiza el tuyo'],
    products: 'labiales',
    style: 'christmas',
    extra: ''
  };

  it('includes the carousel conditions and the exact texts', () => {
    const prompt = buildBannerPrompt(base);

    expect(prompt).toContain('2172 × 724 píxeles');
    expect(prompt).toContain('proporción 3:1');
    expect(prompt).toContain('franja inferior central');
    expect(prompt).toContain('#EC1C79');
    expect(prompt).toContain('Titular: "Regala belleza"');
    expect(prompt).toContain('"Ver regalos" y "Cotiza el tuyo"');
    expect(prompt).toContain('navideño');
  });

  it('asks for no text at all in background mode', () => {
    const prompt = buildBannerPrompt({ ...base, mode: 'background' });

    expect(prompt).toContain('NO incluyas ningún texto');
    expect(prompt).not.toContain('Titular:');
    expect(prompt).not.toContain('Ver regalos');
  });

  it('skips empty optional parts', () => {
    const prompt = buildBannerPrompt({ ...base, subtitle: ' ', buttons: ['', ''], extra: '' });

    expect(prompt).not.toContain('Texto secundario');
    expect(prompt).not.toContain('Botón');
    expect(prompt).not.toContain('INDICACIONES ADICIONALES');
  });
});

function setup(banners: HomeBanner[] = [banner(1), banner(2, { isActive: false, isVisibleToday: false }), banner(3)]) {
  const service = {
    getAll: vi.fn().mockReturnValue(of(banners)),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    uploadImage: vi.fn(),
    reorder: vi.fn(),
    getVisible: vi.fn().mockReturnValue(of([]))
  };
  TestBed.configureTestingModule({
    imports: [AdminHomeBannersComponent],
    providers: [provideRouter([]), { provide: HomeBannerService, useValue: service }]
  });
  const fixture = TestBed.createComponent(AdminHomeBannersComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, service, root: fixture.nativeElement as HTMLElement };
}

it('lists the banners in carousel order with their status', () => {
  const { root } = setup();
  const rows = Array.from(root.querySelectorAll('.banner-row'));

  expect(rows.map(row => row.querySelector('strong')?.textContent?.trim())).toEqual(['1. banner 1', '2. banner 2', '3. banner 3']);
  expect(rows[1].textContent).toContain('Inactivo');
  expect(rows[1].classList).toContain('banner-row--hidden');
});

it('previews only what the store shows today, or the fallback banners', () => {
  expect(setup().component.previewSlides().map(slide => slide.id)).toEqual(['banner-1', 'banner-3']);

  TestBed.resetTestingModule();
  expect(setup([]).component.previewSlides()).toBe(HOME_SLIDES);
});

it('puts the unsaved changes of the selected banner in the preview', () => {
  const { component } = setup();

  component.select(component.banners()[1]);
  component.form.controls.title.setValue('Nuevo título');

  const slides = component.previewSlides();
  expect(slides.map(slide => slide.id)).toEqual(['banner-1', 'banner-2', 'banner-3']);
  expect(slides[1].title).toBe('Nuevo título');
  expect(component.draftHiddenToday()).toBe(true);
});

it('asks for the zones when the banner links by zones', () => {
  const { component } = setup();

  component.select(component.banners()[0]);
  component.form.controls.linkMode.setValue('zones');
  expect(component.formProblem()).toContain('Dibuja al menos una zona');

  component.addHotspot();
  expect(component.formProblem()).toContain('Completa la zona 1');

  component.hotspots.at(0).patchValue({ label: 'Ver catálogo', link: '/catalogo' });
  expect(component.formProblem()).toBeNull();
});

it('saves the new order and restores it if the API fails', () => {
  const { component, service } = setup();
  const reordered = [banner(3), banner(1), banner(2, { isActive: false, isVisibleToday: false })];
  service.reorder.mockReturnValueOnce(of(reordered));

  component.move(2, 0);
  expect(service.reorder).toHaveBeenCalledWith([3, 1, 2]);
  expect(component.banners().map(item => item.id)).toEqual([3, 1, 2]);

  service.reorder.mockReturnValueOnce(throwError(() => new Error('down')));
  component.move(0, 1);
  expect(component.banners().map(item => item.id)).toEqual([3, 1, 2]);
});

it('prefills the AI prompt with the banner texts', () => {
  const { component } = setup();

  component.select(component.banners()[0]);
  component.form.controls.linkMode.setValue('zones');
  component.addHotspot();
  component.hotspots.at(0).patchValue({ label: 'Ver regalos', link: '/catalogo' });
  component.openPrompt();

  expect(component.promptOpen()).toBe(true);
  expect(component.prompt()).toContain('Titular: "Título 1"');
  expect(component.prompt()).toContain('"Ver regalos"');
});
