import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { CategoryService } from '../../core/services/category.service';
import { CategoryMenuItem } from '../../shared/models/category.model';
import { SearchBoxComponent } from '../../shared/components/search-box/search-box.component';
import { AccountAdminLink, AccountPanelComponent } from './account-panel/account-panel.component';

/**
 * Accesos al back office. Solo se muestran si el backend confirma que la sesión
 * puede administrar; ocultarlos es UX, la protección real está en el API.
 */
const ADMIN_LINKS: AccountAdminLink[] = [
  { label: 'Categorías de productos', icon: 'pi pi-sitemap', path: '/admin/categories' },
  { label: 'Productos', icon: 'pi pi-shopping-bag', path: '/admin/products' },
  { label: 'Administradores', icon: 'pi pi-users', path: '/admin/users' }
];

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AccountPanelComponent, SearchBoxComponent],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss'
})
export class PublicLayoutComponent {
  private readonly categoryService = inject(CategoryService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly canManageStore = this.auth.canManageStore;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly menu = signal<CategoryMenuItem[]>([]);
  readonly adminLinks = ADMIN_LINKS;

  readonly isAccountOpen = signal(false);
  readonly loginReturnUrl = signal<string | null>(null);

  readonly openMenuId = signal<number | null>(null);
  readonly isAdminMenuOpen = signal(false);
  readonly expandedChildIds = signal<Set<number>>(new Set());
  readonly isMobileMenuOpen = signal(false);
  readonly isMobileSearchOpen = signal(false);

  /** Lo buscado en /productos?q=, para que la caja muestre la búsqueda vigente. */
  readonly searchTerm = signal('');

  constructor() {
    this.categoryService.getMenu().subscribe({
      next: menu => this.menu.set(menu),
      // Si la API no responde, la tienda sigue navegable sin el menú de categorías.
      error: () => this.menu.set([])
    });

    this.auth.ensureSession().subscribe();

    // El guard del administrador redirige aquí con ?login=1 para abrir la cuenta.
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(params => {
        if (params.get('login') === '1') {
          this.loginReturnUrl.set(params.get('returnUrl'));
          this.isAccountOpen.set(true);
        }
      });

    // La caja refleja la búsqueda de la URL; fuera de /productos queda vacía.
    const syncSearchTerm = () => {
      const tree = this.router.parseUrl(this.router.url);
      const onProducts = tree.root.children['primary']?.segments.map(s => s.path).join('/') === 'productos';

      this.searchTerm.set(onProducts ? (tree.queryParams['q'] ?? '') : '');
    };

    syncSearchTerm();
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe(syncSearchTerm);
  }

  openAccount(): void {
    this.closeMegaMenu();
    this.isAccountOpen.set(true);
  }

  closeAccount(): void {
    this.isAccountOpen.set(false);
    this.loginReturnUrl.set(null);
  }

  logout(): void {
    this.closeMegaMenu();
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/'));
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
