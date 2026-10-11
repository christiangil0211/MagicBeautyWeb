import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProductFilters, ProductService } from '../../../../core/services/product.service';
import { Category } from '../../../../shared/models/category.model';
import { ProductListItem } from '../../../../shared/models/product.model';
import { UncategorizedProductsComponent } from './uncategorized-products.component';

const shampooCategory: Category = {
  id: 21,
  name: 'Shampoo',
  slug: 'shampoo',
  parentCategoryId: 20,
  displayOrder: 10,
  isActive: true,
  showInHome: false,
  showInNavigation: true,
  showInMegaMenu: false,
  createdAt: '',
  updatedAt: '',
};
function product(id: number, name: string, isActive = true): ProductListItem {
  return {
    id,
    name,
    reference: 'CAP' + id,
    brandId: 1,
    brandName: 'Marca',
    hasVariants: false,
    isActive,
    totalQuantity: 0,
    categories: [],
  };
}
function setup(category: Category | null = shampooCategory) {
  // Imita al API: lista los productos sin categoría y los retira al asignarles una.
  let stored = [
    product(301, 'Shampoo sin sal'),
    product(302, 'Shampoo anticaspa'),
    product(303, 'Shampoo descontinuado', false),
    product(304, 'Mascarilla nutritiva'),
  ];
  const api = {
    getAll: vi.fn((filters: ProductFilters): Observable<ProductListItem[]> => {
      const term = (filters.search ?? '').toLowerCase();
      return of(
        stored.filter(
          (item) =>
            item.name.toLowerCase().includes(term) || item.reference.toLowerCase().includes(term),
        ),
      );
    }),
    assignCategory: vi.fn(
      (_categoryId: number, productIds: number[]): Observable<{ updatedCount: number }> => {
        stored = stored.filter((item) => !productIds.includes(item.id));
        return of({ updatedCount: productIds.length });
      },
    ),
  };
  const messages = { add: vi.fn() };
  const confirmations: Confirmation[] = [];
  TestBed.configureTestingModule({
    imports: [UncategorizedProductsComponent],
    providers: [
      { provide: ProductService, useValue: api },
      { provide: MessageService, useValue: messages },
      {
        provide: ConfirmationService,
        useValue: { confirm: (confirmation: Confirmation) => confirmations.push(confirmation) },
      },
    ],
  });
  const fixture = TestBed.createComponent(UncategorizedProductsComponent);
  fixture.componentRef.setInput('category', category ?? undefined);
  fixture.detectChanges();
  return { api, messages, confirmations, fixture, component: fixture.componentInstance };
}
function ids(items: ProductListItem[]): number[] {
  return items.map((item) => item.id);
}
function rows(fixture: ComponentFixture<UncategorizedProductsComponent>): string[][] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'), (row) =>
    Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim() ?? ''),
  );
}
function button(
  fixture: ComponentFixture<UncategorizedProductsComponent>,
  label: string,
): HTMLButtonElement {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
  ).find((item) => item.textContent?.trim() === label)!;
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it('lists only products without category, active and inactive, with checkbox, reference and name', async () => {
  const { api, fixture, component } = setup();
  await fixture.whenStable();
  fixture.detectChanges();

  expect(api.getAll).toHaveBeenCalledWith({ search: null, hasCategories: false });
  expect(api.getAll.mock.calls[0][0]).not.toHaveProperty('isActive');
  expect(ids(component.products())).toEqual([301, 302, 303, 304]);
  expect(
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('thead th'), (cell) =>
      cell.textContent?.trim(),
    ),
  ).toEqual(['Seleccionar', 'Referencia', 'Producto']);
  expect(rows(fixture)[2]).toEqual(['', 'CAP303', 'Shampoo descontinuado']);
  expect((fixture.nativeElement as HTMLElement).querySelectorAll('p-tablecheckbox').length).toBe(4);
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
  expect(api.getAll).toHaveBeenLastCalledWith({ search: 'mascarilla', hasCategories: false });
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
  expect(ids(component.products())).toEqual([302]);
  expect(component.selected()).toEqual([]);
  expect(component.assigning()).toBe(false);
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
it('shows a different empty state for no pending products and for a search without results', async () => {
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
      '<span class="confirm-category-path">Cuidado Capilar › Shampoo</span>',
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
