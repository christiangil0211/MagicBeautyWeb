import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProductFilters, ProductService } from '../../../../core/services/product.service';
import { Category } from '../../../../shared/models/category.model';
import { ProductCategoryLink, ProductListItem } from '../../../../shared/models/product.model';
import { CategoryProductAssignmentComponent } from './category-product-assignment.component';

const shampooCategory: Category = {
  id: 21,
  name: 'Shampoo',
  slug: 'shampoo',
  parentCategoryId: 20,
  displayOrder: 10,
  isActive: true,
  showInHome: false,
  showAsHomeCarousel: false,
  showInNavigation: true,
  showInMegaMenu: false,
  createdAt: '',
  updatedAt: '',
};
function link(categoryId: number, name: string): ProductCategoryLink {
  return { categoryId, name, slug: name.toLowerCase() };
}
function product(
  id: number,
  name: string,
  isActive = true,
  categoryLinks: ProductCategoryLink[] = [],
): ProductListItem {
  return {
    id,
    name,
    reference: 'CAP' + id,
    brandId: 1,
    brandName: 'Marca',
    hasVariants: false,
    isActive,
    totalQuantity: 0,
    categories: categoryLinks.map((item) => item.name),
    categoryLinks,
  };
}
const defaultProducts = [
  product(301, 'Shampoo sin sal'),
  product(302, 'Shampoo anticaspa'),
  product(303, 'Shampoo descontinuado', false),
  product(304, 'Mascarilla nutritiva'),
];
function manyProducts(count: number): ProductListItem[] {
  return Array.from({ length: count }, (_, index) =>
    product(401 + index, (index < 3 ? 'Tinte ' : 'Crema ') + (index + 1)),
  );
}
function setup(category: Category | null = shampooCategory, initial = defaultProducts) {
  // Imita al API: filtra por búsqueda y por "sin categoría", y al asignar agrega el
  // vínculo conservando las categorías que el producto ya tenía.
  let stored = [...initial];
  // Por categoría el API suma las subcategorías: 22 ("Sin sulfatos") es hija de Shampoo (21).
  const subtree: Record<number, number[]> = { 21: [21, 22] };
  const api = {
    getAll: vi.fn((filters: ProductFilters): Observable<ProductListItem[]> => {
      const term = (filters.search ?? '').toLowerCase();
      const inCategory =
        filters.categoryId == null ? null : (subtree[filters.categoryId] ?? [filters.categoryId]);
      return of(
        stored.filter(
          (item) =>
            (item.name.toLowerCase().includes(term) ||
              item.reference.toLowerCase().includes(term)) &&
            (filters.hasCategories !== false || item.categoryLinks.length === 0) &&
            (inCategory === null ||
              item.categoryLinks.some((current) => inCategory.includes(current.categoryId))),
        ),
      );
    }),
    unassignCategory: vi.fn(
      (categoryId: number, productIds: number[]): Observable<{ updatedCount: number }> => {
        let updatedCount = 0;
        stored = stored.map((item) => {
          if (
            !productIds.includes(item.id) ||
            !item.categoryLinks.some((current) => current.categoryId === categoryId)
          ) {
            return item;
          }
          updatedCount++;
          return product(
            item.id,
            item.name,
            item.isActive,
            item.categoryLinks.filter((current) => current.categoryId !== categoryId),
          );
        });
        return of({ updatedCount });
      },
    ),
    assignCategory: vi.fn(
      (categoryId: number, productIds: number[]): Observable<{ updatedCount: number }> => {
        stored = stored.map((item) =>
          productIds.includes(item.id)
            ? product(item.id, item.name, item.isActive, [
                ...item.categoryLinks,
                link(categoryId, 'Shampoo'),
              ])
            : item,
        );
        return of({ updatedCount: productIds.length });
      },
    ),
  };
  const messages = { add: vi.fn() };
  const confirmations: Confirmation[] = [];
  TestBed.configureTestingModule({
    imports: [CategoryProductAssignmentComponent],
    providers: [
      { provide: ProductService, useValue: api },
      { provide: MessageService, useValue: messages },
      {
        provide: ConfirmationService,
        useValue: { confirm: (confirmation: Confirmation) => confirmations.push(confirmation) },
      },
    ],
  });
  const fixture = TestBed.createComponent(CategoryProductAssignmentComponent);
  fixture.componentRef.setInput('category', category ?? undefined);
  fixture.detectChanges();
  return { api, messages, confirmations, fixture, component: fixture.componentInstance };
}
function ids(items: ProductListItem[]): number[] {
  return items.map((item) => item.id);
}
function rows(fixture: ComponentFixture<CategoryProductAssignmentComponent>): string[][] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'), (row) =>
    Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim() ?? ''),
  );
}
function button(
  fixture: ComponentFixture<CategoryProductAssignmentComponent>,
  label: string,
): HTMLButtonElement {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
  ).find((item) => item.textContent?.trim() === label)!;
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it('lists every product by default, active and inactive, with reference, name and categories', async () => {
  const { api, fixture, component } = setup();
  await fixture.whenStable();
  fixture.detectChanges();

  expect(api.getAll).toHaveBeenCalledWith({ search: null, hasCategories: null });
  expect(api.getAll.mock.calls[0][0]).not.toHaveProperty('isActive');
  expect(component.scope()).toBe('all');
  expect(ids(component.products())).toEqual([301, 302, 303, 304]);
  expect(
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('thead th'), (cell) =>
      cell.textContent?.trim(),
    ),
  ).toEqual(['Seleccionar', 'Referencia', 'Producto', 'Categorías']);
  expect(rows(fixture)[2]).toEqual(['', 'CAP303', 'Shampoo descontinuado', 'Sin categoría']);
  expect((fixture.nativeElement as HTMLElement).querySelectorAll('p-tablecheckbox').length).toBe(4);
});
it('filters by "Sin categoría" and goes back to every product', () => {
  const { api, fixture, component } = setup(shampooCategory, [
    product(301, 'Shampoo sin sal'),
    product(302, 'Shampoo clásico', true, [link(30, 'Ofertas')]),
  ]);
  const filter = (fixture.nativeElement as HTMLElement).querySelector('p-selectbutton')?.textContent;
  expect(filter).toContain('Todos');
  expect(filter).toContain('Sin categoría');

  component.scopeChanged('uncategorized');
  expect(api.getAll).toHaveBeenLastCalledWith({ search: null, hasCategories: false });
  expect(ids(component.products())).toEqual([301]);

  component.scopeChanged('all');
  expect(api.getAll).toHaveBeenLastCalledWith({ search: null, hasCategories: null });
  expect(ids(component.products())).toEqual([301, 302]);
});
it('shows the categories a product already has and marks the one selected in the tree', () => {
  const { fixture, component } = setup(shampooCategory, [
    product(301, 'Shampoo sin sal'),
    product(302, 'Shampoo clásico', true, [link(30, 'Ofertas'), link(21, 'Shampoo')]),
    product(303, 'Kit capilar', true, [
      link(30, 'Ofertas'),
      link(31, 'Kits'),
      link(32, 'Regalos'),
      link(33, 'Novedades'),
      link(34, 'Temporada'),
    ]),
  ]);
  fixture.detectChanges();
  const row = (index: number) =>
    (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')[index] as HTMLElement;
  const chips = (index: number) =>
    Array.from(row(index).querySelectorAll('.chip'), (item) => item.textContent?.trim());

  expect(chips(0)).toEqual(['Sin categoría']);
  // La categoría seleccionada va primero y resaltada; el resto se conserva.
  expect(chips(1)).toEqual(['Shampoo', 'Ofertas']);
  expect(row(1).querySelector('.chip--current')?.textContent?.trim()).toBe('Shampoo');
  expect(row(1).classList).toContain('row--assigned');
  // Solo tres chips visibles; las demás quedan en "+N" con su nombre en el tooltip.
  expect(chips(2)).toEqual(['Ofertas', 'Kits', 'Regalos', '+2']);
  expect(component.hiddenCategoriesTooltip(component.products()[2])).toBe('Novedades, Temporada');
  expect(
    (fixture.nativeElement as HTMLElement).querySelector('.panel__count')?.textContent,
  ).toMatch(/0 de 2 seleccionados\s*· 1 ya en esta categoría/);
});
it('does not let you select products that already have the selected category', () => {
  const { fixture, component } = setup(shampooCategory, [
    product(301, 'Shampoo sin sal'),
    product(302, 'Shampoo clásico', true, [link(21, 'Shampoo')]),
    product(303, 'Mascarilla', true, [link(30, 'Ofertas')]),
  ]);

  button(fixture, 'Seleccionar todo').click();
  expect(ids(component.selected())).toEqual([301, 303]);
  expect(component.isAssigned(component.products()[1])).toBe(true);
  expect(component.isAssigned(component.products()[2])).toBe(false);
});
it('drops from the selection the products that already have the newly chosen category', () => {
  const { fixture, component } = setup(shampooCategory, [
    product(301, 'Shampoo sin sal'),
    product(302, 'Acondicionador', true, [link(22, 'Acondicionador')]),
  ]);
  component.selectAll();
  expect(ids(component.selected())).toEqual([301, 302]);

  fixture.componentRef.setInput('category', { ...shampooCategory, id: 22, name: 'Acondicionador' });
  fixture.detectChanges();

  expect(ids(component.selected())).toEqual([301]);
});
it('shows the three actions in order: clear selection, select all, add category', () => {
  const { fixture } = setup();
  expect(
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.toolbar__actions button'),
      (item) => item.textContent?.trim(),
    ),
  ).toEqual(['Quitar selección', 'Seleccionar todo', 'Agregar categoría']);
});
it('searches while typing without Enter and ignores an obsolete response', async () => {
  const { api, fixture, component } = setup();
  const responses: { search: string | null | undefined; response: Subject<ProductListItem[]> }[] =
    [];
  api.getAll.mockImplementation((filters: ProductFilters) => {
    const response = new Subject<ProductListItem[]>();
    responses.push({ search: filters.search, response });
    return response;
  });
  const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;

  input.value = ' masc';
  input.dispatchEvent(new Event('input'));
  await wait(400);
  input.value = ' mascarilla ';
  input.dispatchEvent(new Event('input'));
  await wait(400);

  expect(responses.map((item) => item.search)).toEqual(['masc', 'mascarilla']);
  expect(api.getAll).toHaveBeenLastCalledWith({ search: 'mascarilla', hasCategories: null });
  responses[1].response.next([product(304, 'Mascarilla nutritiva')]);
  responses[0].response.next([product(999, 'Respuesta vieja')]);
  expect(ids(component.products())).toEqual([304]);
});
it('selects every listed product and clears the selection without touching the products', () => {
  const { api, fixture, component } = setup();

  button(fixture, 'Seleccionar todo').click();
  fixture.detectChanges();
  expect(ids(component.selected())).toEqual([301, 302, 303, 304]);
  expect(
    (fixture.nativeElement as HTMLElement).querySelector('.panel__count')?.textContent,
  ).toContain('4 de 4 seleccionados');

  button(fixture, 'Quitar selección').click();
  fixture.detectChanges();
  expect(component.selected()).toEqual([]);
  expect(ids(component.products())).toEqual([301, 302, 303, 304]);
  expect(api.assignCategory).not.toHaveBeenCalled();
});
it('selects only the products shown by the search and drops the ones the search hides', async () => {
  const { fixture, component } = setup();
  component.selected.set([component.products()[3]]);

  component.searchChanged('shampoo');
  await wait(400);
  expect(ids(component.products())).toEqual([301, 302, 303]);
  expect(component.selected()).toEqual([]);

  button(fixture, 'Seleccionar todo').click();
  expect(ids(component.selected())).toEqual([301, 302, 303]);
});
it('does not assign without selected products', () => {
  const { api, messages, confirmations, component } = setup();

  component.confirmAssign();

  expect(confirmations).toEqual([]);
  expect(api.assignCategory).not.toHaveBeenCalled();
  expect(messages.add).toHaveBeenCalledWith(
    expect.objectContaining({ severity: 'warn', summary: 'Selecciona productos' }),
  );
});
it('asks for a category when none is selected in the tree', () => {
  const { api, messages, confirmations, component } = setup(null);
  component.selectAll();

  component.confirmAssign();

  expect(confirmations).toEqual([]);
  expect(api.assignCategory).not.toHaveBeenCalled();
  expect(messages.add).toHaveBeenCalledWith(
    expect.objectContaining({ severity: 'warn', summary: 'Selecciona una categoría' }),
  );
});
it('confirms with the category name and changes nothing when cancelled', () => {
  const { api, confirmations, component } = setup({
    ...shampooCategory,
    name: 'Shampoo <b>& más</b>',
  });
  component.selected.set(component.products().slice(0, 2));

  component.confirmAssign();

  const confirmation = confirmations[0];
  expect(confirmation.message).toContain(
    'Los productos seleccionados se actualizarán con la siguiente categoría:',
  );
  expect(confirmation.message).toContain(
    '<span class="confirm-category-path">Shampoo &lt;b&gt;&amp; más&lt;/b&gt;</span>',
  );
  expect(confirmation.acceptLabel).toBe('Confirmar');
  expect(confirmation.rejectLabel).toBe('Cancelar');
  confirmation.reject?.();
  expect(api.assignCategory).not.toHaveBeenCalled();
  expect(ids(component.selected())).toEqual([301, 302]);
  expect(ids(component.products())).toEqual([301, 302, 303, 304]);
});
it('assigns the selected category to active and inactive products, reports the count and refreshes the table', () => {
  const { api, messages, confirmations, component } = setup();
  component.selected.set([
    component.products()[0],
    component.products()[2],
    component.products()[3],
  ]);

  component.confirmAssign();
  confirmations[0].accept?.();

  expect(api.assignCategory).toHaveBeenCalledExactlyOnceWith(21, [301, 303, 304]);
  expect(messages.add).toHaveBeenCalledWith(
    expect.objectContaining({
      severity: 'success',
      detail: 'Se actualizaron 3 productos con la categoría "Shampoo".',
    }),
  );
  // Siguen en la tabla (pueden recibir otras categorías), pero ya no son seleccionables.
  expect(ids(component.products())).toEqual([301, 302, 303, 304]);
  expect(ids(component.assignable())).toEqual([302]);
  expect(component.selected()).toEqual([]);
  expect(component.assigning()).toBe(false);
});
it('removes the assigned products from the table when filtering by "Sin categoría"', () => {
  const { confirmations, component } = setup();
  component.scopeChanged('uncategorized');
  component.selected.set([component.products()[0], component.products()[3]]);

  component.confirmAssign();
  confirmations[0].accept?.();

  expect(ids(component.products())).toEqual([302, 303]);
});
it('shows the loader while assigning and keeps the selection when the API fails', () => {
  const { api, messages, confirmations, fixture, component } = setup();
  const pending = new Subject<{ updatedCount: number }>();
  api.assignCategory.mockReturnValueOnce(pending);
  component.selected.set([component.products()[0]]);

  component.confirmAssign();
  confirmations[0].accept?.();
  fixture.detectChanges();
  expect(component.assigning()).toBe(true);
  expect((fixture.nativeElement as HTMLElement).querySelector('app-loader')?.textContent).toContain(
    'Agregando categoría',
  );
  // Mientras se asigna no se lanza una segunda operación.
  component.confirmAssign();
  expect(confirmations.length).toBe(1);

  pending.error({ error: { error: 'La categoría no existe.' } });
  fixture.detectChanges();
  expect(component.assigning()).toBe(false);
  expect(ids(component.selected())).toEqual([301]);
  expect(ids(component.products())).toEqual([301, 302, 303, 304]);
  expect(messages.add).toHaveBeenCalledWith(
    expect.objectContaining({ severity: 'error', detail: 'La categoría no existe.' }),
  );
});
it('uses the singular message for one product', () => {
  const { messages, confirmations, component } = setup();
  component.selected.set([component.products()[1]]);

  component.confirmAssign();
  confirmations[0].accept?.();

  expect(messages.add).toHaveBeenCalledWith(
    expect.objectContaining({ detail: 'Se actualizó 1 producto con la categoría "Shampoo".' }),
  );
});
it('shows a different empty state for each filter and for a search without results', async () => {
  const { api, fixture, component } = setup();
  const empty = () =>
    (fixture.nativeElement as HTMLElement).querySelector('.panel__empty strong')?.textContent;

  component.searchChanged('zzz');
  await wait(400);
  fixture.detectChanges();
  expect(empty()).toBe('Sin resultados');

  api.getAll.mockReturnValue(of([]));
  component.searchChanged('');
  await wait(400);
  fixture.detectChanges();
  expect(empty()).toBe('Aún no hay productos');

  component.scopeChanged('uncategorized');
  fixture.detectChanges();
  expect(empty()).toBe('Todo está organizado');
});
it('reports a load error with the application toast', () => {
  const { api, messages, component } = setup();
  api.getAll.mockReturnValueOnce(throwError(() => ({ error: { error: 'Sin conexión' } })));

  component.load();

  expect(messages.add).toHaveBeenCalledWith(
    expect.objectContaining({ severity: 'error', detail: 'Sin conexión' }),
  );
  expect(component.loading()).toBe(false);
});
it('shows the instruction when no category is selected and the tree branch when one is', () => {
  const { fixture } = setup(null);
  const hint = () =>
    (fixture.nativeElement as HTMLElement)
      .querySelector('.panel__hint')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
  expect(hint()).toBe(
    'Selecciona una categoría en el árbol, marca los productos y pulsa "Agregar categoría".',
  );

  fixture.componentRef.setInput('category', shampooCategory);
  fixture.componentRef.setInput('categoryPath', ['Cuidado Capilar', 'Shampoo']);
  fixture.detectChanges();
  expect(hint()).toMatch(/^Agregando productos a: Cuidado Capilar ?Shampoo$/);
  expect(
    (fixture.nativeElement as HTMLElement).querySelector('.category-path__current')?.textContent,
  ).toBe('Shampoo');

  fixture.componentRef.setInput('category', undefined);
  fixture.componentRef.setInput('categoryPath', []);
  fixture.detectChanges();
  expect(hint()).toContain('Selecciona una categoría en el árbol');
});
it('shows the full branch of the category in the confirmation dialog', () => {
  const { confirmations, fixture, component } = setup();
  fixture.componentRef.setInput('categoryPath', ['Cuidado Capilar', 'Shampoo']);
  component.selectAll();

  component.confirmAssign();

  expect(confirmations[0].message).toBe(
    'Los productos seleccionados se actualizarán con la siguiente categoría:' +
      '<span class="confirm-category-path">Cuidado Capilar › Shampoo</span>' +
      '<span class="confirm-category-note">Las categorías que ya tienen se conservan.</span>',
  );
});
it('uses the search loader message while searching', async () => {
  const { api, fixture, component } = setup();
  api.getAll.mockReturnValue(new Subject<ProductListItem[]>());
  const loader = () =>
    (fixture.nativeElement as HTMLElement).querySelector('app-loader.loader--overlay')?.textContent;

  component.load();
  fixture.detectChanges();
  expect(loader()).toContain('Cargando productos…');

  component.searchChanged('shampoo');
  fixture.detectChanges();
  expect(loader()).toContain('Buscando productos…');
});
function goToPage(fixture: ComponentFixture<CategoryProductAssignmentComponent>, page: number): void {
  Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.p-paginator-page'),
  )
    .find((item) => item.textContent?.trim() === String(page))!
    .click();
  fixture.detectChanges();
}
it('hides the paginator when every product fits in one page', () => {
  const { fixture } = setup();

  expect((fixture.nativeElement as HTMLElement).querySelector('.p-paginator')).toBeNull();
  expect(rows(fixture).length).toBe(4);
});
it('paginates the table and keeps the selection made on other pages', () => {
  const { fixture, component } = setup(shampooCategory, manyProducts(23));

  expect(rows(fixture).length).toBe(10);
  expect(rows(fixture)[0][1]).toBe('CAP401');
  component.selected.set([component.products()[0], component.products()[1]]);

  goToPage(fixture, 3);
  expect(component.first()).toBe(20);
  expect(rows(fixture).map((row) => row[1])).toEqual(['CAP421', 'CAP422', 'CAP423']);
  expect(ids(component.selected())).toEqual([401, 402]);

  component.selected.set([...component.selected(), component.products()[22]]);
  goToPage(fixture, 1);
  expect(ids(component.selected())).toEqual([401, 402, 423]);
  expect(
    (fixture.nativeElement as HTMLElement).querySelector('.panel__count')?.textContent,
  ).toContain('3 de 23 seleccionados');
});
it('selects and assigns the products of every page, not only the visible one', () => {
  const { api, confirmations, fixture, component } = setup(shampooCategory, manyProducts(23));

  button(fixture, 'Seleccionar todo').click();
  expect(component.selected().length).toBe(23);

  component.confirmAssign();
  confirmations[0].accept?.();
  expect(api.assignCategory.mock.calls[0][1].length).toBe(23);
});
it('goes back to the first page when the search changes', async () => {
  const { fixture, component } = setup(shampooCategory, manyProducts(23));
  goToPage(fixture, 3);

  component.searchChanged('tinte');
  await wait(400);
  fixture.detectChanges();

  expect(component.first()).toBe(0);
  expect(rows(fixture).map((row) => row[1])).toEqual(['CAP401', 'CAP402', 'CAP403']);
});
it('steps back to the last page with products after assigning the whole current page', () => {
  const { confirmations, fixture, component } = setup(shampooCategory, manyProducts(23));
  // Solo con el filtro "Sin categoría" los productos asignados salen de la tabla.
  component.scopeChanged('uncategorized');
  fixture.detectChanges();
  goToPage(fixture, 3);
  component.selected.set(component.products().slice(20));

  component.confirmAssign();
  confirmations[0].accept?.();
  fixture.detectChanges();

  expect(component.products().length).toBe(20);
  expect(component.first()).toBe(10);
  expect(rows(fixture)[0][1]).toBe('CAP411');
});

const categoryProducts = [
  product(301, 'Shampoo sin sal', true, [link(21, 'Shampoo'), link(30, 'Ofertas')]),
  product(302, 'Shampoo sin sulfatos', true, [link(22, 'Sin sulfatos')]),
  product(303, 'Shampoo descontinuado', false, [link(21, 'Shampoo')]),
  product(304, 'Mascarilla nutritiva'),
];

it('consults the products of the category including its subcategories and toggles back', () => {
  const { api, fixture, component } = setup(shampooCategory, categoryProducts);

  button(fixture, 'Consultar productos').click();
  fixture.detectChanges();

  expect(api.getAll).toHaveBeenLastCalledWith({ search: null, hasCategories: null, categoryId: 21 });
  expect(component.isCategoryView()).toBe(true);
  expect(ids(component.products())).toEqual([301, 302, 303]);
  // Solo se puede desasociar lo que tiene la categoría directamente.
  expect(ids(component.selectable())).toEqual([301, 303]);
  expect(component.notSelectableReason(component.products()[1])).toContain('subcategoría');
  expect(
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.toolbar__actions button'),
      (item) => item.textContent?.trim(),
    ),
  ).toEqual(['Quitar selección', 'Seleccionar todo', 'Desasociar productos']);

  button(fixture, 'Consultar productos').click();
  fixture.detectChanges();

  expect(component.scope()).toBe('all');
  expect(api.getAll).toHaveBeenLastCalledWith({ search: null, hasCategories: null });
  expect(button(fixture, 'Agregar categoría')).toBeTruthy();
});

it('consults the new category when another one is chosen in the tree', () => {
  const { api, fixture, component } = setup(shampooCategory, categoryProducts);
  component.toggleCategoryView();
  component.selectAll();

  fixture.componentRef.setInput('category', { ...shampooCategory, id: 22, name: 'Sin sulfatos' });
  fixture.detectChanges();

  expect(api.getAll).toHaveBeenLastCalledWith({ search: null, hasCategories: null, categoryId: 22 });
  expect(ids(component.products())).toEqual([302]);
  expect(component.selected()).toEqual([]);

  fixture.componentRef.setInput('category', undefined);
  fixture.detectChanges();

  expect(component.scope()).toBe('all');
  expect(ids(component.products())).toEqual([301, 302, 303, 304]);
});

it('unassigns the selected products after confirming and keeps their other categories', () => {
  const { api, messages, confirmations, fixture, component } = setup(
    shampooCategory,
    categoryProducts,
  );
  component.toggleCategoryView();
  component.selectAll();
  fixture.detectChanges();

  button(fixture, 'Desasociar productos').click();
  expect(confirmations.length).toBe(1);
  expect(confirmations[0].header).toBe('Desasociar productos');
  expect(api.unassignCategory).not.toHaveBeenCalled();

  confirmations[0].accept!();
  fixture.detectChanges();

  expect(api.unassignCategory).toHaveBeenCalledWith(21, [301, 303]);
  expect(messages.add).toHaveBeenLastCalledWith(
    expect.objectContaining({
      severity: 'success',
      detail: 'Se quitaron 2 productos de la categoría "Shampoo".',
    }),
  );
  // Queda solo el que llega por la subcategoría, y 301 conserva "Ofertas".
  expect(ids(component.products())).toEqual([302]);
  expect(component.selected()).toEqual([]);
  expect(component.unassigning()).toBe(false);
});

it('asks to select products before unassigning', () => {
  const { api, messages, confirmations, component } = setup(shampooCategory, categoryProducts);
  component.toggleCategoryView();

  component.confirmUnassign();

  expect(confirmations.length).toBe(0);
  expect(api.unassignCategory).not.toHaveBeenCalled();
  expect(messages.add).toHaveBeenCalledWith(
    expect.objectContaining({ severity: 'warn', summary: 'Selecciona productos' }),
  );
});

it('disables "Consultar productos" while no category is selected', () => {
  const { fixture } = setup(null);
  expect(button(fixture, 'Consultar productos').disabled).toBe(true);
});
