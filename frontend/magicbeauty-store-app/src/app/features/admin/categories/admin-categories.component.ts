import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService, PrimeTemplate, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TreeModule } from 'primeng/tree';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../shared/models/category.model';

interface ParentOption {
  label: string;
  value: number | null;
}

@Component({
  selector: 'app-admin-categories',
  imports: [
    ReactiveFormsModule,
    TreeModule,
    PrimeTemplate,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    InputNumberModule,
    ToggleSwitchModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    PageHeaderComponent,
    LoaderComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.scss',
})
export class AdminCategoriesComponent {
  private readonly categoryService = inject(CategoryService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly imageKinds = [
    { kind: 'home' as const, label: 'Imagen del inicio', field: 'homeImageUrl' as const },
    { kind: 'image' as const, label: 'Imagen del mega menú', field: 'imageUrl' as const },
    { kind: 'icon' as const, label: 'Ícono', field: 'iconUrl' as const },
  ];
  readonly pendingFiles = signal<Partial<Record<'image' | 'home' | 'icon', File>>>({});
  readonly pendingRemovals = signal<('image' | 'home' | 'icon')[]>([]);

  selectImage(kind: 'image' | 'home' | 'icon', event: Event): void {
    if (this.saving()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && (file.size === 0 || file.size > 8 * 1024 * 1024)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Revisa la imagen',
        detail: 'Selecciona un archivo de hasta 8 MB que no esté vacío.',
      });
      input.value = '';
      return;
    }
    if (file) {
      this.pendingFiles.update((files) => ({ ...files, [kind]: file }));
      this.pendingRemovals.update((kinds) => kinds.filter((item) => item !== kind));
    }
    input.value = '';
  }

  removeImage(kind: 'image' | 'home' | 'icon'): void {
    if (this.saving()) return;
    this.pendingFiles.update((files) => {
      const next = { ...files };
      delete next[kind];
      return next;
    });
    this.pendingRemovals.update((kinds) => (kinds.includes(kind) ? kinds : [...kinds, kind]));
  }

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly selectedNode = signal<TreeNode | null>(null);

  readonly treeNodes = computed(() => this.buildTree(this.categories()));

  readonly selectedCategory = computed(() =>
    this.categories().find((category) => category.id === this.selectedId()),
  );

  readonly visibleInMenuCount = computed(
    () =>
      this.categories().filter((category) => category.isActive && category.showInNavigation).length,
  );

  readonly homeCount = computed(
    () => this.categories().filter((category) => category.showInHome).length,
  );

  /**
   * La jerarquía no tiene tope de niveles: lo normal son tres, pero puede bajar más.
   * La única restricción real es que un padre no puede ser la propia categoría
   * ni un descendiente suyo, porque eso crearía un ciclo.
   */
  readonly parentOptions = computed<ParentOption[]>(() => {
    const all = this.categories();
    const editingId = this.selectedId();
    const blocked = editingId === null ? new Set<number>() : this.collectSubtreeIds(all, editingId);

    const options: ParentOption[] = [{ label: 'Categoría raíz (nivel 1)', value: null }];

    const walk = (parentId: number | null, level: number): void => {
      for (const category of this.childrenOf(all, parentId)) {
        if (!blocked.has(category.id)) {
          options.push({
            label: '— '.repeat(level - 1) + category.name,
            value: category.id,
          });
        }

        walk(category.id, level + 1);
      }
    };

    walk(null, 1);

    return options;
  });

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    slug: ['', [Validators.required, Validators.maxLength(180)]],
    description: [''],
    parentCategoryId: [null as number | null],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
    showInNavigation: [true],
    showInMegaMenu: [false],
    showInHome: [false],
    imageUrl: [''],
    homeImageUrl: [''],
    iconUrl: [''],
  });

  constructor() {
    this.load();
  }

  load(selectAfterLoad?: number): void {
    this.loading.set(true);

    this.categoryService.getAll().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);

        if (selectAfterLoad !== undefined) {
          this.selectById(selectAfterLoad);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.showError('No se pudieron cargar las categorías', error);
      },
    });
  }

  newCategory(parentCategoryId: number | null = null): void {
    if (this.saving()) return;
    this.pendingFiles.set({});
    this.pendingRemovals.set([]);
    this.selectedId.set(null);
    this.selectedNode.set(null);

    this.form.reset({
      name: '',
      slug: '',
      description: '',
      parentCategoryId,
      displayOrder: this.nextDisplayOrder(parentCategoryId),
      isActive: true,
      showInNavigation: true,
      showInMegaMenu: false,
      showInHome: false,
      imageUrl: '',
      homeImageUrl: '',
      iconUrl: '',
    });
  }

  addChildOfSelected(): void {
    const parent = this.selectedCategory();

    if (parent) {
      this.newCategory(parent.id);
    }
  }

  onNodeSelect(node: TreeNode): void {
    if (this.saving()) return;
    const category = node.data as Category | undefined;

    if (category) {
      this.applyCategoryToForm(category);
    }
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { imageUrl, homeImageUrl, iconUrl, ...value } = this.form.getRawValue();
    const hasHome =
      this.pendingFiles().home || (homeImageUrl.trim() && !this.pendingRemovals().includes('home'));
    if (value.showInHome && !hasHome) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Falta la imagen del inicio',
        detail: 'Selecciona una imagen para la tarjeta.',
      });
      return;
    }
    this.saving.set(true);
    let id = this.selectedId();
    try {
      if (id === null) {
        const created = await firstValueFrom(this.categoryService.create(value));
        id = created.id;
        this.selectedId.set(id);
        this.categories.update((categories) => [...categories, created]);
      } else await firstValueFrom(this.categoryService.update(id, value));
      for (const image of this.imageKinds) {
        const file = this.pendingFiles()[image.kind];
        if (file) {
          const updated = await firstValueFrom(
            this.categoryService.uploadImage(id, image.kind, file),
          );
          this.form.controls[image.field].setValue(updated[image.field] ?? '');
          this.pendingFiles.update((files) => {
            const next = { ...files };
            delete next[image.kind];
            return next;
          });
          this.categories.update((categories) =>
            categories.map((category) => (category.id === id ? updated : category)),
          );
        } else if (this.pendingRemovals().includes(image.kind)) {
          const updated = await firstValueFrom(this.categoryService.deleteImage(id, image.kind));
          this.form.controls[image.field].setValue(updated[image.field] ?? '');
          this.pendingRemovals.update((kinds) => kinds.filter((kind) => kind !== image.kind));
          this.categories.update((categories) =>
            categories.map((category) => (category.id === id ? updated : category)),
          );
        }
      }
      this.notifySaved('Los cambios se guardaron.');
      this.load(id);
    } catch (error) {
      this.showError(
        'No se pudo completar el guardado; puedes reintentar las imágenes pendientes',
        error,
      );
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(): void {
    if (this.saving()) return;
    const category = this.selectedCategory();

    if (!category) {
      return;
    }

    this.confirmationService.confirm({
      header: 'Eliminar categoría',
      message: 'Se eliminará "' + category.name + '". Esta acción no se puede deshacer.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.delete(category.id),
    });
  }

  generateSlug(): void {
    const name = this.form.controls.name.value.trim();

    if (!name) {
      return;
    }

    const slugControl = this.form.controls.slug;

    // No pisamos un slug que el usuario ya editó a mano.
    if (slugControl.dirty && slugControl.value.trim()) {
      return;
    }

    slugControl.setValue(this.toSlug(name));
  }

  storefrontPath(): string {
    const slug = this.form.controls.slug.value.trim();

    return slug ? '/categoria/' + slug : '/categoria/...';
  }

  private delete(id: number): void {
    this.categoryService.delete(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Categoría eliminada',
          detail: 'La categoría se quitó del catálogo.',
        });

        this.newCategory();
        this.load();
      },
      error: (error) => this.showError('No se pudo eliminar', error),
    });
  }

  private applyCategoryToForm(category: Category): void {
    this.pendingFiles.set({});
    this.pendingRemovals.set([]);
    this.selectedId.set(category.id);

    this.form.reset({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      parentCategoryId: category.parentCategoryId ?? null,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      showInNavigation: category.showInNavigation,
      showInMegaMenu: category.showInMegaMenu,
      showInHome: category.showInHome,
      imageUrl: category.imageUrl ?? '',
      homeImageUrl: category.homeImageUrl ?? '',
      iconUrl: category.iconUrl ?? '',
    });
  }

  private selectById(id: number): void {
    const category = this.categories().find((item) => item.id === id);

    if (!category) {
      return;
    }

    this.applyCategoryToForm(category);
    this.selectedNode.set(this.findNode(this.treeNodes(), id));
  }

  private findNode(nodes: TreeNode[], id: number): TreeNode | null {
    for (const node of nodes) {
      if ((node.data as Category).id === id) {
        return node;
      }

      const match = this.findNode(node.children ?? [], id);

      if (match) {
        return match;
      }
    }

    return null;
  }

  private buildTree(categories: Category[]): TreeNode[] {
    const toNode = (category: Category): TreeNode => ({
      key: String(category.id),
      label: category.name,
      data: category,
      expanded: true,
      children: this.childrenOf(categories, category.id).map(toNode),
    });

    return this.childrenOf(categories, null).map(toNode);
  }

  private childrenOf(categories: Category[], parentId: number | null): Category[] {
    return categories
      .filter((category) => (category.parentCategoryId ?? null) === parentId)
      .sort(
        (first, second) =>
          first.displayOrder - second.displayOrder || first.name.localeCompare(second.name),
      );
  }

  private collectSubtreeIds(categories: Category[], rootId: number): Set<number> {
    const ids = new Set<number>([rootId]);
    const pending = [rootId];

    while (pending.length > 0) {
      const currentId = pending.pop()!;

      for (const child of categories.filter(
        (category) => category.parentCategoryId === currentId,
      )) {
        if (!ids.has(child.id)) {
          ids.add(child.id);
          pending.push(child.id);
        }
      }
    }

    return ids;
  }

  private nextDisplayOrder(parentCategoryId: number | null): number {
    const siblings = this.childrenOf(this.categories(), parentCategoryId);

    return siblings.length === 0 ? 10 : Math.max(...siblings.map((item) => item.displayOrder)) + 10;
  }

  private toSlug(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private notifySaved(detail: string): void {
    this.messageService.add({ severity: 'success', summary: 'Listo', detail });
  }

  private showError(summary: string, error: unknown): void {
    const httpError = error as HttpErrorResponse;
    const detail = httpError?.error?.error ?? 'Ocurrió un error inesperado.';

    this.messageService.add({ severity: 'error', summary, detail, life: 6000 });
  }
}
