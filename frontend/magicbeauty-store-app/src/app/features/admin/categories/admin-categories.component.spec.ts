import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminCategoriesComponent } from './admin-categories.component';
import { CategoryService } from '../../../core/services/category.service';
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
    providers: [{ provide: CategoryService, useValue: api }],
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
