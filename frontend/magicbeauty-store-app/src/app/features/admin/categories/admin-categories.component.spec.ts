import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminCategoriesComponent } from './admin-categories.component';
import { CategoryService } from '../../../core/services/category.service';
import { ProductService } from '../../../core/services/product.service';
import { UncategorizedProductsComponent } from './uncategorized-products/uncategorized-products.component';
import { By } from '@angular/platform-browser';
import { Category } from '../../../shared/models/category.model';

const category: Category = {
  id: 6,
  name: 'Labiales',
  slug: 'labiales',
  displayOrder: 0,
  isActive: true,
  showInHome: false,
  showInNavigation: true,
  showInMegaMenu: false,
  createdAt: '',
  updatedAt: '',
};
function setup() {
  const api = {
    getAll: vi.fn(() => of([] as Category[])),
    create: vi.fn(() => of(category)),
    update: vi.fn(() => of(undefined)),
    uploadImage: vi.fn((_id: number, _kind: string, _file: File) =>
      of({ ...category, imageUrl: '/media/categories/6/image/new.png' }),
    ),
    deleteImage: vi.fn(() => of(category)),
  };
  TestBed.configureTestingModule({
    imports: [AdminCategoriesComponent],
    providers: [
      { provide: CategoryService, useValue: api },
      { provide: ProductService, useValue: { getAll: () => of([]), assignCategory: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(AdminCategoriesComponent);
  const component = fixture.componentInstance;
  component.form.patchValue({
    name: 'Labiales',
    slug: 'labiales',
    imageUrl: 'stale-image',
    homeImageUrl: 'stale-home',
    iconUrl: 'stale-icon',
  });
  return { api, fixture, component };
}
it('creates the category before uploading and excludes URLs from JSON', async () => {
  const { api, component } = setup();
  const file = new File(['png'], 'image.png', { type: 'image/png' });
  component.pendingFiles.set({ image: file });
  await component.save();
  expect(api.create).toHaveBeenCalledOnce();
  const body = api.create.mock.calls[0] as unknown[];
  expect(body[0]).not.toHaveProperty('imageUrl');
  expect(body[0]).not.toHaveProperty('homeImageUrl');
  expect(body[0]).not.toHaveProperty('iconUrl');
  expect(api.uploadImage).toHaveBeenCalledWith(6, 'image', file);
  expect(api.create.mock.invocationCallOrder[0]).toBeLessThan(
    api.uploadImage.mock.invocationCallOrder[0],
  );
});
it('keeps the created ID and pending file after failure so retry does not create a second category', async () => {
  const { api, component } = setup();
  const file = new File(['png'], 'image.png', { type: 'image/png' });
  component.pendingFiles.set({ image: file });
  api.uploadImage.mockReturnValueOnce(throwError(() => new Error('Upload failed')));
  await component.save();
  expect(component.selectedId()).toBe(6);
  expect(component.pendingFiles().image).toBe(file);
  await component.save();
  expect(api.create).toHaveBeenCalledOnce();
  expect(api.update).toHaveBeenCalledOnce();
  expect(api.uploadImage).toHaveBeenCalledTimes(2);
});
it('renders file inputs instead of URL text inputs', async () => {
  const { fixture } = setup();
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelectorAll('input[type="file"]').length).toBe(3);
  expect(fixture.nativeElement.querySelector('[formControlName="imageUrl"]')).toBeNull();
  expect(fixture.nativeElement.querySelector('[formControlName="homeImageUrl"]')).toBeNull();
  expect(fixture.nativeElement.querySelector('[formControlName="iconUrl"]')).toBeNull();
});

const hierarchy: Category[] = [
  { ...category, id: 1, parentCategoryId: null },
  { ...category, id: 2, parentCategoryId: 1 },
  { ...category, id: 3, parentCategoryId: 2 },
];
function visibleFiles(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll<HTMLInputElement>('input[type="file"]')).map(
    (input) => input.id,
  );
}
it('recalculates visible image controls immediately when the parent changes at every level', async () => {
  const { fixture, component } = setup();
  component.categories.set(hierarchy);
  for (const [parent, kinds] of [
    [null, ['home', 'image', 'icon']],
    [1, ['image', 'icon']],
    [2, ['icon']],
    [3, ['icon']],
    [null, ['home', 'image', 'icon']],
  ] as const) {
    component.form.controls.parentCategoryId.setValue(parent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(visibleFiles(fixture.nativeElement)).toEqual(
      kinds.map((kind) => 'category-file-' + kind),
    );
  }
});
it('uses the persisted parent when selecting a category for editing', async () => {
  const { fixture, component } = setup();
  component.categories.set(hierarchy);
  component.onNodeSelect({ data: hierarchy[2] });
  fixture.detectChanges();
  await fixture.whenStable();
  expect(visibleFiles(fixture.nativeElement)).toEqual(['category-file-icon']);
});
it('preserves existing URLs and pending selections during temporary parent changes', () => {
  const { component } = setup();
  component.categories.set(hierarchy);
  const home = new File(['png'], 'home.png');
  component.pendingFiles.set({ home });
  component.form.controls.parentCategoryId.setValue(2);
  expect(component.form.controls.homeImageUrl.value).toBe('stale-home');
  expect(component.form.controls.imageUrl.value).toBe('stale-image');
  component.form.controls.parentCategoryId.setValue(null);
  expect(component.pendingFiles().home).toBe(home);
});
it('does not send hidden pending uploads or deletions when saving a deeper category', async () => {
  const { api, component } = setup();
  component.categories.set(hierarchy);
  component.form.patchValue({ parentCategoryId: 2, showInHome: true, homeImageUrl: '' });
  const icon = new File(['png'], 'icon.png');
  component.pendingFiles.set({ home: new File(['png'], 'home.png'), icon });
  component.pendingRemovals.set(['image']);
  await component.save();
  expect(api.create).toHaveBeenCalledOnce();
  expect(api.uploadImage).toHaveBeenCalledExactlyOnceWith(6, 'icon', icon);
  expect(api.deleteImage).not.toHaveBeenCalled();
});

const hairCare: Category = {
  ...category,
  id: 20,
  name: 'Cuidado capilar',
  slug: 'cuidado-capilar',
};
function fillNewChild(component: AdminCategoriesComponent, name: string): void {
  component.form.controls.name.setValue(name);
  component.generateSlug();
}
it('leaves the form ready for a sibling after creating, so the next save creates instead of overwriting', async () => {
  const { api, component } = setup();
  const stored: Category[] = [hairCare];
  let nextId = 21;
  api.getAll.mockImplementation(() => of([...stored]));
  api.create.mockImplementation(((request: Partial<Category>) => {
    const created = { ...category, ...request, id: nextId++ } as Category;
    stored.push(created);
    return of(created);
  }) as never);
  component.load();
  component.newCategory(hairCare.id);

  for (const name of ['Shampoo', 'Acondicionador', 'Mascarilla']) {
    fillNewChild(component, name);
    await component.save();
    expect(component.selectedId()).toBeNull();
    expect(component.form.controls.name.value).toBe('');
    expect(component.form.controls.slug.value).toBe('');
    expect(component.form.controls.parentCategoryId.value).toBe(hairCare.id);
  }

  expect(api.create).toHaveBeenCalledTimes(3);
  expect(api.update).not.toHaveBeenCalled();
  expect(stored.map((item) => item.name)).toEqual([
    'Cuidado capilar',
    'Shampoo',
    'Acondicionador',
    'Mascarilla',
  ]);
  expect(component.categories().map((item) => item.slug)).toEqual([
    'cuidado-capilar',
    'shampoo',
    'acondicionador',
    'mascarilla',
  ]);
  // Cada hermana nueva recibe el siguiente orden libre.
  expect(component.form.controls.displayOrder.value).toBe(40);
});
it('does not let a late reload put the form back on the previously saved category', async () => {
  const { api, component } = setup();
  const shampoo: Category = {
    ...category,
    id: 21,
    name: 'Shampoo',
    slug: 'shampoo',
    parentCategoryId: 20,
  };
  component.categories.set([hairCare, shampoo]);
  component.onNodeSelect({ data: shampoo });
  const reload = new Subject<Category[]>();
  api.getAll.mockReturnValue(reload as never);

  await component.save();
  expect(api.update).toHaveBeenCalledOnce();
  // El usuario empieza otra categoría antes de que responda la recarga.
  component.newCategory(hairCare.id);
  fillNewChild(component, 'Acondicionador');
  reload.next([hairCare, shampoo]);

  expect(component.selectedId()).toBeNull();
  expect(component.form.controls.name.value).toBe('Acondicionador');
  await component.save();
  expect(api.create).toHaveBeenCalledOnce();
  expect(api.update).toHaveBeenCalledOnce();
});
it('clears the form after saving an edit, so typing a new name creates instead of overwriting', async () => {
  const { api, component } = setup();
  const shampoo: Category = {
    ...category,
    id: 21,
    name: 'Shampoo',
    slug: 'shampoo',
    parentCategoryId: 20,
    displayOrder: 10,
  };
  component.categories.set([hairCare, shampoo]);
  component.onNodeSelect({ data: shampoo });
  component.selectedNode.set({ key: '21', data: shampoo });
  api.getAll.mockReturnValue(of([hairCare, { ...shampoo, name: 'Shampoo sin sal' }]) as never);
  component.form.controls.name.setValue('Shampoo sin sal');

  await component.save();

  expect(api.update).toHaveBeenCalledExactlyOnceWith(
    21,
    expect.objectContaining({ name: 'Shampoo sin sal' }),
  );
  // Vuelve a "Nueva categoría" en el mismo nivel, sin nada seleccionado en el árbol.
  expect(component.selectedId()).toBeNull();
  expect(component.selectedNode()).toBeNull();
  expect(component.selectedCategory()).toBeUndefined();
  expect(component.form.controls.name.value).toBe('');
  expect(component.form.controls.slug.value).toBe('');
  expect(component.form.controls.parentCategoryId.value).toBe(20);
  expect(component.form.controls.displayOrder.value).toBe(20);
  expect(component.categories().find((item) => item.id === 21)?.name).toBe('Shampoo sin sal');

  fillNewChild(component, 'Acondicionador');
  await component.save();
  expect(api.create).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: 'Acondicionador', slug: 'acondicionador' }),
  );
  expect(api.update).toHaveBeenCalledOnce();
});
it('stays on the edited category when saving fails, so the changes are not lost', async () => {
  const { api, component } = setup();
  const shampoo: Category = { ...category, id: 21, name: 'Shampoo', slug: 'shampoo' };
  component.categories.set([shampoo]);
  component.onNodeSelect({ data: shampoo });
  component.form.controls.name.setValue('Shampoo sin sal');
  api.update.mockReturnValueOnce(throwError(() => new Error('Update failed')) as never);

  await component.save();

  expect(component.selectedId()).toBe(21);
  expect(component.form.controls.name.value).toBe('Shampoo sin sal');
});
it('ignores a stale category list that arrives after a newer reload', () => {
  const { api, component } = setup();
  const first = new Subject<Category[]>();
  const second = new Subject<Category[]>();
  api.getAll.mockReturnValueOnce(first as never).mockReturnValueOnce(second as never);
  component.load();
  component.load();

  second.next([hairCare, { ...category, id: 21, name: 'Shampoo', slug: 'shampoo' }]);
  first.next([hairCare]);

  expect(component.categories().map((item) => item.id)).toEqual([20, 21]);
});

it('passes the category selected in the tree to the uncategorized products table', async () => {
  const { fixture, component } = setup();
  component.categories.set(hierarchy);
  fixture.detectChanges();
  await fixture.whenStable();
  const table = fixture.debugElement.query(By.directive(UncategorizedProductsComponent))
    .componentInstance as UncategorizedProductsComponent;
  expect(table.category()).toBeUndefined();

  component.onNodeSelect({ data: hierarchy[2] });
  fixture.detectChanges();
  expect(table.category()?.id).toBe(3);

  component.newCategory();
  fixture.detectChanges();
  expect(table.category()).toBeUndefined();
});
it('builds the branch of the selected category from the root', () => {
  const { component } = setup();
  const branch: Category[] = [
    { ...category, id: 1, name: 'Cuidado Capilar', parentCategoryId: null },
    { ...category, id: 2, name: 'Shampoo', parentCategoryId: 1 },
    { ...category, id: 3, name: 'Sin sal', parentCategoryId: 2 },
  ];
  component.categories.set(branch);
  expect(component.selectedCategoryPath()).toEqual([]);

  component.onNodeSelect({ data: branch[2] });
  expect(component.selectedCategoryPath()).toEqual(['Cuidado Capilar', 'Shampoo', 'Sin sal']);

  component.onNodeSelect({ data: branch[0] });
  expect(component.selectedCategoryPath()).toEqual(['Cuidado Capilar']);
});
