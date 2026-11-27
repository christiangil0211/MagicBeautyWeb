import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PublicHomeBanner } from '../../../shared/models/home-banner.model';
import { HOME_SLIDES, HomeSlide, colombiaDate, homeSlideSrcset, orderHomeSlides, slideFromBanner } from './home-slides';

describe('slideFromBanner', () => {
  const banner: PublicHomeBanner = {
    id: 7,
    name: 'navidad',
    title: 'Regala belleza',
    altText: 'Regala belleza esta Navidad',
    imageUrl: 'https://blob/home-banners/7/a.jpg',
    imageWidth: 2172,
    imageHeight: 724,
    imageUrl768: 'https://blob/home-banners/7/a-768.webp',
    imageUrl1280: null,
    link: null,
    hotspots: [{ label: 'Ver', link: '/catalogo', left: 2, top: 80, width: 15, height: 12 }],
    mobileCtas: [],
    noteHighlight: 'Navidad:',
    noteText: null
  };

  it('maps an admin banner to a carousel slide', () => {
    const slide = slideFromBanner(banner);

    expect(slide).toMatchObject({ id: 'banner-7', name: 'navidad', alt: 'Regala belleza esta Navidad', width: 2172, height: 724 });
    expect(slide.hotspots?.length).toBe(1);
    expect(slide.mobileCtas).toBeUndefined();
    expect(slide.note).toEqual({ strong: 'Navidad:', text: '' });
  });

  it('only offers the light copies that exist', () => {
    expect(homeSlideSrcset(slideFromBanner(banner))).toBe(
      'https://blob/home-banners/7/a-768.webp 768w, https://blob/home-banners/7/a.jpg 2172w'
    );
    expect(homeSlideSrcset(slideFromBanner({ ...banner, imageUrl768: null }))).toBe('https://blob/home-banners/7/a.jpg 2172w');
  });
});

describe('homeSlideSrcset', () => {
  it('offers light WebP copies for phones and the original for wide screens', () => {
    expect(homeSlideSrcset({ image: '/images/campaigns/banner.jpg', width: 2172 })).toBe(
      '/images/campaigns/banner-768.webp 768w, /images/campaigns/banner-1280.webp 1280w, /images/campaigns/banner.jpg 2172w'
    );
  });

  it.each(HOME_SLIDES.map(slide => [slide.id, slide] as const))('has every size of the %s banner on disk', (_id, slide) => {
    for (const candidate of homeSlideSrcset(slide).split(', ')) {
      const file = candidate.split(' ')[0];
      expect(existsSync(join(process.cwd(), 'public', file))).toBe(true);
    }
  });
});

const slide = (id: string, featured?: HomeSlide['featured']): HomeSlide =>
  ({ id, name: id, title: id, image: '/x.jpg', width: 1, height: 1, alt: id, featured });

describe('orderHomeSlides', () => {
  const slides = [slide('a'), slide('season', { from: '2026-11-01', until: '2026-12-24' }), slide('b')];

  it('puts the featured banner first during its season, dates inclusive', () => {
    for (const day of ['2026-11-01T12:00:00-05:00', '2026-12-24T23:30:00-05:00']) {
      expect(orderHomeSlides(slides, new Date(day)).map(item => item.id)).toEqual(['season', 'a', 'b']);
    }
  });

  it('moves the featured banner to the end out of season', () => {
    expect(orderHomeSlides(slides, new Date('2026-12-25T00:30:00-05:00')).map(item => item.id)).toEqual(['a', 'b', 'season']);
    expect(orderHomeSlides(slides, new Date('2026-10-31T23:00:00-05:00')).map(item => item.id)).toEqual(['a', 'b', 'season']);
  });

  it('uses the Colombian date, not UTC', () => {
    // 24-dic a las 21:00 en Cali ya es 25-dic en UTC.
    expect(colombiaDate(new Date('2026-12-25T02:00:00Z'))).toBe('2026-12-24');
  });

  it('keeps the advent calendar first and featured until Christmas Eve', () => {
    expect(HOME_SLIDES[0].id).toBe('calendars');
    expect(HOME_SLIDES[0].featured).toEqual({ from: '2026-11-01', until: '2026-12-24' });
  });
});
