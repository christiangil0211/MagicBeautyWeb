import { isCategoryPath } from './portal-banner.component';

it.each([
  ['/catalogo/categoria/labiales', true],
  ['/categoria/maquillaje', true],
  ['/categoria/maquillaje/', true],
  ['/catalogo', false],
  ['/catalogo/ACO011', false],
  ['/productos', false],
  ['/', false],
  ['/admin/categories', false]
])('recognizes %s as a category page: %s', (path, expected) => {
  expect(isCategoryPath(path)).toBe(expected);
});
