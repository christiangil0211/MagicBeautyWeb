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
