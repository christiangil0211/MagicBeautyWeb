import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { STORE_CONTACT, STORE_SOCIAL_LINKS, whatsappDisplayPhone, whatsappUrl } from '../../core/constants/store-contact';
import { AuthService } from '../../core/services/auth.service';
import { OrderDraftService } from '../../core/services/order-draft.service';
import { CategoryService } from '../../core/services/category.service';
import { PORTAL_MENU_LABEL, PORTAL_TABS, isPortalUrl } from '../../features/public/portal/portal-navigation';
import { CategoryMenuItem } from '../../shared/models/category.model';
import { SearchBoxComponent } from '../../shared/components/search-box/search-box.component';
import { WhatsappButtonComponent } from '../../shared/components/whatsapp-button/whatsapp-button.component';
import { AccountAdminLink, AccountPanelComponent } from './account-panel/account-panel.component';

/**
 * Accesos al back office. Solo se muestran si el backend confirma que la sesión
 * puede administrar; ocultarlos es UX, la protección real está en el API.
 */
const ADMIN_LINKS: AccountAdminLink[] = [
  { label: 'Categorías de productos', icon: 'pi pi-sitemap', path: '/admin/categories' },
  { label: 'Productos', icon: 'pi pi-shopping-bag', path: '/admin/products' },
  { label: 'Catálogos tradicionales', icon: 'pi pi-book', path: '/admin/catalogs' },
  { label: 'Administradores', icon: 'pi pi-users', path: '/admin/users' }
];


@Component({
  selector: 'app-public-layout',
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AccountPanelComponent,
    SearchBoxComponent,
    WhatsappButtonComponent
  ],
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
  readonly portalTabs = PORTAL_TABS;
  readonly portalMenuLabel = PORTAL_MENU_LABEL;

  /** Unidades del pedido temporal, para el contador de "Mi pedido". */
  readonly orderCount = inject(OrderDraftService).itemCount;

  /** Contacto oficial: el mismo WhatsApp del botón flotante y del pedido. */
  readonly whatsappHref = whatsappUrl();
  readonly whatsappPhone = whatsappDisplayPhone();
  readonly socialLinks = STORE_SOCIAL_LINKS;
  /** Correo y dirección oficiales (pie de página y menú móvil). */
  readonly contact = STORE_CONTACT;

  /**
   * Navegación del e-commerce (mega menú de categorías y favoritos). Apagada
   * mientras el portal es la única experiencia pública; se reactiva con
   * `data: { ecommerceNavigation: true }` en la ruta del layout.
   */
  readonly ecommerceNavigation = input(false);

  /**
   * Barra de menú: los visitantes no la ven mientras el portal es la única
   * experiencia; un administrador sí, con el portal como una opción más.
   */
  readonly showHeaderSearch = computed(() => this.ecommerceNavigation() || this.isAuthenticated());
  readonly showMenu = computed(() => this.ecommerceNavigation() || this.isAuthenticated());

  /** El ítem del portal se marca en cualquiera de sus pestañas. */
  readonly onPortal = signal(false);
  readonly activeCategorySlug = signal<string | null>(null);

  readonly isAccountOpen = signal(false);
  readonly loginReturnUrl = signal<string | null>(null);

  readonly openMenuId = signal<number | null>(null);
  readonly isAdminMenuOpen = signal(false);
  readonly expandedChildIds = signal<Set<number>>(new Set());
  readonly isMobileMenuOpen = signal(false);
  readonly isMobileSearchOpen = signal(false);

  /** Lo buscado en /catalogo?q=, para que la caja muestre la búsqueda vigente. */
  readonly searchTerm = signal('');

  constructor() {
    const document = inject(DOCUMENT);
    effect(onCleanup => {
      if (!this.isMobileMenuOpen() && !this.isMobileSearchOpen()) return;
      const elements = [document.documentElement, document.body];
      const previous = elements.map(element => ({
        value: element.style.getPropertyValue('overflow'),
        priority: element.style.getPropertyPriority('overflow')
      }));
      elements.forEach(element => element.style.setProperty('overflow', 'hidden'));
      onCleanup(() => elements.forEach((element, index) => {
        const { value, priority } = previous[index];
        if (value) element.style.setProperty('overflow', value, priority);
        else element.style.removeProperty('overflow');
      }));
    });

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

    // La caja refleja la búsqueda de la URL; fuera de /catalogo queda vacía.
    const syncSearchTerm = () => {
      const tree = this.router.parseUrl(this.router.url);
      const onCatalog = ['catalogo', 'productos'].includes(tree.root.children['primary']?.segments.map(s => s.path).join('/') ?? '');

      this.searchTerm.set(onCatalog ? (tree.queryParams['q'] ?? '') : '');
      this.onPortal.set(isPortalUrl(this.router.url));
      const segments = tree.root.children['primary']?.segments ?? [];
      this.activeCategorySlug.set(segments[0]?.path === 'categoria' ? (segments[1]?.path ?? null) : null);
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

  expandChild(id: number): void {
    this.expandedChildIds.update(ids => new Set([...ids, id]));
  }

  collapseChild(id: number): void {
    this.expandedChildIds.update(ids => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
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

  isCategoryActive(item: CategoryMenuItem): boolean {
    return item.slug === this.activeCategorySlug() || item.children.some(child => this.isCategoryActive(child));
  }

  categoryPath(slug: string): string {
    return '/categoria/' + slug;
  }

  openMobileMenu(): void {
    this.isMobileSearchOpen.set(false);
    this.isMobileMenuOpen.set(true);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  openMobileSearch(): void {
    if (!this.showHeaderSearch()) return;
    this.isMobileMenuOpen.set(false);
    this.isMobileSearchOpen.set(true);
  }

  closeMobileSearch(): void {
    this.isMobileSearchOpen.set(false);
  }
}
