import { vi } from 'vitest';

import { scrollBelowHeader } from './scroll-below-header';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function rect(top: number, height = 0): DOMRect {
  return { top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

it('scrolls the element just below the visible part of the sticky header', () => {
  const header = document.createElement('header');
  header.className = 'store-header';
  header.style.top = '-30px';
  vi.spyOn(header, 'getBoundingClientRect').mockReturnValue(rect(0, 180));
  const target = document.createElement('div');
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect(900));
  document.body.append(header, target);
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

  scrollBelowHeader(target);

  // 900 (posición) - (180 - 30) (cabecera visible) - 16 (aire) = 734.
  expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 734 }));
});

it('does nothing without an element', () => {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  scrollBelowHeader(null);
  expect(scrollTo).not.toHaveBeenCalled();
});
