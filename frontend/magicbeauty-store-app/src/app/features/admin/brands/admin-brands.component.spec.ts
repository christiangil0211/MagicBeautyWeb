import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BrandService } from '../../../core/services/brand.service';
import { Brand } from '../../../shared/models/brand.model';
import { AdminBrandsComponent, LOGO_MAX_BYTES, brandSlug } from './admin-brands.component';

describe('brandSlug', () => {
  it.each([
    ['PÚRPURE', 'purpure'],
    ['Kevin & Coco', 'kevin-coco'],
    ['  Ritual   Botánico ', 'ritual-botanico'],
    ['La Poción', 'la-pocion']
  ])('turns %s into %s, like the API', (name, slug) => {
    expect(brandSlug(name)).toBe(slug);
  });
});

const BRANDS: Brand[] = [
  { id: 1, name: 'Purpure', slug: 'purpure', logoUrl: 'https://blob/p.png', isFeatured: true, sortOrder: 0, isActive: true, productCount: 3, createdAt: '', updatedAt: '' },
  { id: 2, name: 'Dear Body', slug: 'dear-body', logoUrl: null, isFeatured: false, sortOrder: 1, isActive: true, productCount: 0, createdAt: '', updatedAt: '' },
  { id: 3, name: 'Ritual Botánico', slug: 'ritual-botanico', logoUrl: null, isFeatured: false, sortOrder: 2, isActive: false, productCount: 1, createdAt: '', updatedAt: '' }
];

function setup() {
  const brandService = {
    getAll: vi.fn().mockReturnValue(of(BRANDS)),
    getProducts: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 25 })),
    create: vi.fn(),
    update: vi.fn(),
    uploadLogo: vi.fn(),
    deleteLogo: vi.fn()
  };
  TestBed.configureTestingModule({ imports: [AdminBrandsComponent], providers: [provideRouter([]), { provide: BrandService, useValue: brandService }] });
  const fixture = TestBed.createComponent(AdminBrandsComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, brandService, root: fixture.nativeElement as HTMLElement };
}

it('lists brands with their logo, product count, featured flag and inactive tag', () => {
  const { root } = setup();
  const rows = Array.from(root.querySelectorAll('.brand-row'));

  expect(rows.map(row => row.querySelector('strong')?.textContent)).toEqual(['Purpure', 'Dear Body', 'Ritual Botánico']);
  expect(rows[0].querySelector('img')?.getAttribute('src')).toBe('https://blob/p.png');
  expect(rows[0].textContent).toContain('3 productos');
  expect(rows[0].querySelector('.pi-star-fill')).not.toBeNull();
  expect(rows[2].textContent).toContain('Inactiva');
});

it('searches ignoring accents and case', () => {
  const { component } = setup();

  component.search.set('botanico');
  expect(component.visibleBrands().map(brand => brand.id)).toEqual([3]);
});

it('generates the URL from the name until the person types one', () => {
  const { component } = setup();
  component.newBrand();

  component.form.controls.name.setValue('Kevin & Coco');
  component.nameChanged();
  expect(component.form.controls.slug.value).toBe('kevin-coco');

  component.form.controls.slug.setValue('kevin-y-coco');
  component.slugTyped();
  component.form.controls.name.setValue('Kevin & Coco Kids');
  component.nameChanged();
  expect(component.form.controls.slug.value).toBe('kevin-y-coco');
});

it('offers to deactivate, never delete, a brand that has products', () => {
  const { component, root, fixture } = setup();

  component.select(BRANDS[0]);
  fixture.detectChanges();
  expect(root.textContent).toContain('Desactivar');

  component.select(BRANDS[1]);
  fixture.detectChanges();
  expect(root.textContent).toContain('Eliminar');
});

it('accepts only PNG, SVG or WebP logos of up to 1 MB', () => {
  const { component } = setup();
  const pick = (file: File) => component.selectLogo({ target: { files: [file], value: '' } } as unknown as Event);

  pick(new File(['x'], 'logo.jpg', { type: 'image/jpeg' }));
  expect(component.pendingLogo()).toBeNull();

  pick(new File([new Uint8Array(LOGO_MAX_BYTES + 1)], 'grande.png', { type: 'image/png' }));
  expect(component.pendingLogo()).toBeNull();

  globalThis.URL.createObjectURL ??= () => 'blob:preview';
  pick(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
  expect(component.pendingLogo()?.name).toBe('logo.svg');
});

it('opens the AI prompt to prepare logos with the store standard', () => {
  const { component, fixture } = setup();

  component.logoPromptOpen.set(true);
  fixture.detectChanges();

  const text = document.querySelector<HTMLTextAreaElement>('#logo-prompt-text');
  expect(text?.value).toContain('2087 × 754');
  expect(text?.value).toContain('menos de 1 MB');
  expect(text?.value).toContain('Sin restos del fondo original');
});
