import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { BrandService } from '../../../core/services/brand.service';
import { PublicBrand } from '../../../shared/models/brand.model';
import { HomeBrandLogosComponent } from './home-brand-logos.component';

const brand = (slug: string, overrides: Partial<PublicBrand> = {}): PublicBrand => ({
  name: slug.toUpperCase(),
  slug,
  logoUrl: `https://blob/${slug}.png`,
  description: null,
  isFeatured: true,
  productCount: 3,
  ...overrides
});

function render(brands: PublicBrand[] | Error) {
  TestBed.configureTestingModule({
    imports: [HomeBrandLogosComponent],
    providers: [
      provideRouter([]),
      { provide: BrandService, useValue: { getPublicBrands: () => (brands instanceof Error ? throwError(() => brands) : of(brands)) } }
    ]
  });
  const fixture = TestBed.createComponent(HomeBrandLogosComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

it('shows only featured brands that have a logo, each linking to its page', () => {
  const root = render([brand('purpure'), brand('sin-logo', { logoUrl: null }), brand('normal', { isFeatured: false })]);
  const links = Array.from(root.querySelectorAll('a.brand-logo'));

  expect(links.map(link => link.getAttribute('href'))).toEqual(['/marcas/purpure']);
  expect(root.querySelector('.brand-logos__all')?.getAttribute('href')).toBe('/marcas');
});

it('lazy-loads every logo with its size reserved and a descriptive alt', () => {
  const root = render([brand('purpure'), brand('dear-body')]);

  for (const image of Array.from(root.querySelectorAll('a.brand-logo img'))) {
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('width')).toBe('160');
    expect(image.getAttribute('height')).toBe('80');
    expect(image.getAttribute('alt')).toMatch(/^Logo de /);
  }
});

it('is reachable with the keyboard: real links and labelled arrow buttons', () => {
  const root = render([brand('purpure'), brand('dear-body')]);

  expect(Array.from(root.querySelectorAll('a.brand-logo')).every(link => link.hasAttribute('href'))).toBe(true);
  expect(Array.from(root.querySelectorAll('button.brand-logos__arrow'), button => button.getAttribute('aria-label'))).toEqual([
    'Ver marcas anteriores',
    'Ver más marcas'
  ]);
});

it.each([
  ['there are no featured brands with a logo', [brand('sin-logo', { logoUrl: null })]],
  ['the API fails', new Error('503')]
])('does not render the section when %s', (_case, brands) => {
  const root = render(brands);

  expect(root.querySelector('.brand-logos')).toBeNull();
});

it('shows each logo in its own colors with the brand name under it', () => {
  const root = render([brand('purpure', { name: 'Purpure' }), brand('milagros', { name: 'Milagros' })]);

  expect(Array.from(root.querySelectorAll('.brand-logo__name'), name => name.textContent?.trim())).toEqual(['Purpure', 'Milagros']);
});
