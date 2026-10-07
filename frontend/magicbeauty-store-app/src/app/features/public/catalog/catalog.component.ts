import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { CategoryService } from '../../../core/services/category.service';
import { CategoryMenuItem } from '../../../shared/models/category.model';

/**
 * Página de categoría. Por ahora solo resuelve la categoría desde el slug y
 * muestra sus subcategorías: el listado de productos llega con el módulo Products.
 */
@Component({
  selector: 'app-catalog',
  imports: [RouterLink],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss'
})
export class CatalogComponent {
  private readonly categoryService = inject(CategoryService);

  /** Viene de la ruta `categoria/:slug` con withComponentInputBinding. */
  readonly slug = input.required<string>();

  private readonly menu = toSignal(this.categoryService.getMenu(), { initialValue: [] });

  readonly current = computed(() => this.findBySlug(this.menu(), this.slug()));

  readonly breadcrumb = computed(() => this.pathTo(this.menu(), this.slug()));

  categoryPath(slug: string): string {
    return '/categoria/' + slug;
  }

  private findBySlug(items: CategoryMenuItem[], slug: string): CategoryMenuItem | null {
    for (const item of items) {
      if (item.slug === slug) {
        return item;
      }

      const match = this.findBySlug(item.children, slug);

      if (match) {
        return match;
      }
    }

    return null;
  }

  private pathTo(items: CategoryMenuItem[], slug: string): CategoryMenuItem[] {
    for (const item of items) {
      if (item.slug === slug) {
        return [item];
      }

      const childPath = this.pathTo(item.children, slug);

      if (childPath.length > 0) {
        return [item, ...childPath];
      }
    }

    return [];
  }
}
