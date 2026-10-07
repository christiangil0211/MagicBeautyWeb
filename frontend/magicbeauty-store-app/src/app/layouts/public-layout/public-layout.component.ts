import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { CategoryService } from '../../core/services/category.service';
import { CategoryMenuItem } from '../../shared/models/category.model';

/**
 * Enlaces que no son categorías del catálogo: son colecciones dinámicas
 * (por marca, por descuento, por fecha de alta) y por eso no se administran aquí.
 */
const DYNAMIC_LINKS = [
  { label: 'Productos', path: '/productos' },
  { label: 'Marcas', path: '/marcas' },
  { label: 'Ofertas', path: '/ofertas' },
  { label: 'Nuevo', path: '/nuevo' }
];

/**
 * Accesos al back office. Hoy son visibles para cualquiera porque todavía no hay
 * autenticación: cuando exista el rol Administrator, este bloque debe quedar detrás de él.
 */
const ADMIN_LINKS = [
  { label: 'Categorías de productos', icon: 'pi pi-sitemap', path: '/admin/categories' },
  { label: 'Productos', icon: 'pi pi-shopping-bag', path: '/admin/products' }
];

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss'
})
export class PublicLayoutComponent {
  private readonly categoryService = inject(CategoryService);

  readonly menu = signal<CategoryMenuItem[]>([]);
  readonly dynamicLinks = DYNAMIC_LINKS;
  readonly adminLinks = ADMIN_LINKS;

  readonly openMenuId = signal<number | null>(null);
  readonly isAdminMenuOpen = signal(false);
  readonly expandedChildIds = signal<Set<number>>(new Set());
  readonly isMobileMenuOpen = signal(false);
  readonly isMobileSearchOpen = signal(false);

  constructor() {
    this.categoryService.getMenu().subscribe({
      next: menu => this.menu.set(menu),
      // Si la API no responde, la tienda sigue navegable sin el menú de categorías.
      error: () => this.menu.set([])
    });
  }

  openMegaMenu(id: number): void {
    if (this.openMenuId() !== id) {
      this.expandedChildIds.set(new Set());
    }

    this.openMenuId.set(id);
    this.isAdminMenuOpen.set(false);
  }

  openAdminMenu(): void {
    this.isAdminMenuOpen.set(true);
    this.openMenuId.set(null);
  }

  /** Cierra cualquier desplegable de la barra de navegación. */
  closeMegaMenu(): void {
    this.openMenuId.set(null);
    this.isAdminMenuOpen.set(false);
    this.expandedChildIds.set(new Set());
  }

  isChildExpanded(id: number): boolean {
    return this.expandedChildIds().has(id);
  }

  /** Abre o cierra el nivel 3 sin navegar ni cerrar el panel. */
  toggleChild(id: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const expanded = new Set(this.expandedChildIds());

    if (!expanded.delete(id)) {
      expanded.add(id);
    }

    this.expandedChildIds.set(expanded);
  }

  categoryPath(slug: string): string {
    return '/categoria/' + slug;
  }

  openMobileMenu(): void {
    this.isMobileMenuOpen.set(true);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  openMobileSearch(): void {
    this.isMobileSearchOpen.set(true);
  }

  closeMobileSearch(): void {
    this.isMobileSearchOpen.set(false);
  }
}
