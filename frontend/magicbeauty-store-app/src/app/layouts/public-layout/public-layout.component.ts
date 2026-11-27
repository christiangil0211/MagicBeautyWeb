import { DOCUMENT, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { STORE_CONTACT, STORE_SOCIAL_LINKS, whatsappDisplayPhone, whatsappUrl } from '../../core/constants/store-contact';
import { AuthService } from '../../core/services/auth.service';
import { OrderDraftService } from '../../core/services/order-draft.service';
import { CategoryService } from '../../core/services/category.service';
import { PORTAL_MENU_LABEL, PORTAL_TABS, WHOLESALE_PATH } from '../../features/public/portal/portal-navigation';
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
  { label: 'Ventas', icon: 'pi pi-chart-bar', path: '/admin/sales' },
  { label: 'Clientes', icon: 'pi pi-id-card', path: '/admin/customers' },
  { label: 'Marcas', icon: 'pi pi-tag', path: '/admin/brands' },
  { label: 'Catálogos tradicionales', icon: 'pi pi-book', path: '/admin/catalogs' },
  { label: 'Banners del inicio', icon: 'pi pi-images', path: '/admin/home-banners' },
  { label: 'Administradores', icon: 'pi pi-users', path: '/admin/users' }
];

/**
 * Tiempo que el puntero debe quedarse sobre una categoría antes de abrirla. Evita
 * que cruzar filas de paso (por ejemplo, subir hacia "Ojos" pasando por "Labios")
 * abra y cierre ramas en cadena.
 */
export const BRANCH_HOVER_DELAY_MS = 150;


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
  /** "Hazte mayorista" lleva a su página y solo se marca activo en ella. */
  readonly wholesalePath = WHOLESALE_PATH;

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
   * El buscador, en cambio, se muestra siempre y a todos.
   */
  readonly showMenu = computed(() => this.ecommerceNavigation() || this.isAuthenticated());

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

  /** Padre de cada categoría del menú, para abrir una rama con todos sus ancestros. */
  private readonly parentIds = computed(() => {
    const parents = new Map<number, number | null>();
    const walk = (items: CategoryMenuItem[], parentId: number | null) =>
      items.forEach(item => {
        parents.set(item.id, parentId);
        walk(item.children, item.id);
      });
    walk(this.menu(), null);
    return parents;
  });

  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private hoverCandidateId: number | null = null;
  private pointer: { x: number; y: number } | null = null;
  /**
   * Dónde estaba el puntero cuando cambió el menú. Al abrir o cerrar ramas las filas
   * se desplazan bajo un puntero quieto y el navegador emite eventos de ratón sin que
   * la persona se haya movido; esos se ignoran para no encadenar aperturas.
   */
  private switchPoint: { x: number; y: number } | null = null;
  /** El panel cambió de tamaño y el puntero aún no se ha movido desde entonces. */
  private resizedSinceMove = false;
  private stopOutsideTracking: (() => void) | null = null;
  private readonly document = inject(DOCUMENT);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.cancelBranchHover();
      this.stopTrackingOutside();
    });

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

    // El menú solo se pide en el navegador (el HTML prerenderizado no consulta la API
    // ni congela el menú) y cuando se va a mostrar: los visitantes del portal no lo
    // ven, y pedirlo en cada visita era una consulta a la base sin uso.
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    let menuRequested = false;
    effect(() => {
      if (!isBrowser || menuRequested || !this.showMenu()) return;
      menuRequested = true;
      untracked(() =>
        this.categoryService.getMenu().subscribe({
          next: menu => this.menu.set(menu),
          // Si la API no responde, la tienda sigue navegable sin el menú de categorías.
          error: () => this.menu.set([])
        })
      );
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
      this.resetBranches();
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
    this.resetBranches();
  }

  isChildExpanded(id: number): boolean {
    return this.expandedChildIds().has(id);
  }

  /**
   * Deja abierta solo la rama de la categoría: ella y sus ancestros. Las hermanas
   * (y lo que tuvieran abierto) se cierran, como un acordeón.
   */
  activateBranch(id: number): void {
    const path = new Set<number>();
    for (let current: number | null | undefined = id; current != null; current = this.parentIds().get(current)) {
      path.add(current);
    }

    if (!sameIds(path, this.expandedChildIds())) {
      this.expandedChildIds.set(path);
      this.switchPoint = this.pointer;
      this.resizedSinceMove = true;
    }
  }

  /**
   * El puntero salió de la barra. Si fue porque el panel se encogió bajo un puntero
   * quieto (al cerrar una rama larga), el menú no se cierra: sigue abierto mientras
   * la persona vuelve hacia él y se cierra en cuanto se aleja.
   */
  leaveMenu(event: MouseEvent): void {
    const menu = event.currentTarget as HTMLElement | null;
    if (!this.resizedSinceMove || !menu) {
      this.closeMegaMenu();
      return;
    }

    this.stopTrackingOutside();
    let closest = distanceToMenu(menu, event.clientX, event.clientY);
    const onMove = (move: MouseEvent) => {
      if (menu.contains(move.target as Node)) {
        this.stopTrackingOutside();
        return;
      }
      const distance = distanceToMenu(menu, move.clientX, move.clientY);
      closest = Math.min(closest, distance);
      if (distance > closest + OUTSIDE_TOLERANCE_PX) {
        this.closeMegaMenu();
      }
    };
    this.document.addEventListener('mousemove', onMove);
    this.stopOutsideTracking = () => this.document.removeEventListener('mousemove', onMove);
  }

  stopTrackingOutside(): void {
    this.stopOutsideTracking?.();
    this.stopOutsideTracking = null;
  }

  /** El puntero se mueve sobre una fila: si se queda en ella, se abre su rama. */
  hoverBranch(id: number, event: MouseEvent): void {
    this.pointer = { x: event.clientX, y: event.clientY };

    // Evento emitido porque la fila se desplazó bajo un puntero quieto.
    if (this.switchPoint && this.switchPoint.x === event.clientX && this.switchPoint.y === event.clientY) return;
    this.resizedSinceMove = false;
    if (this.hoverCandidateId === id) return;

    this.cancelBranchHover();
    this.hoverCandidateId = id;
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      this.hoverCandidateId = null;
      this.activateBranch(id);
    }, BRANCH_HOVER_DELAY_MS);
  }

  /** Salir de una fila solo cancela su apertura pendiente; no cierra nada. */
  leaveBranch(id: number): void {
    if (this.hoverCandidateId === id) {
      this.cancelBranchHover();
    }
  }

  /** Abre o cierra el nivel 3 sin navegar ni cerrar el panel. */
  toggleChild(id: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cancelBranchHover();

    if (this.isChildExpanded(id)) {
      this.expandedChildIds.update(ids => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    } else {
      this.activateBranch(id);
    }
  }

  private cancelBranchHover(): void {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
    }
    this.hoverTimer = null;
    this.hoverCandidateId = null;
  }

  private resetBranches(): void {
    this.cancelBranchHover();
    this.stopTrackingOutside();
    this.expandedChildIds.set(new Set());
    this.resizedSinceMove = false;
    this.switchPoint = null;
    this.pointer = null;
  }

  isCategoryActive(item: CategoryMenuItem): boolean {
    return item.slug === this.activeCategorySlug() || item.children.some(child => this.isCategoryActive(child));
  }

  categoryPath(slug: string): string {
    return '/categoria/' + slug;
  }

  /** Página pública de la categoría dentro del catálogo digital. */
  catalogCategoryPath(slug: string): string {
    return '/catalogo/categoria/' + slug;
  }

  openMobileMenu(): void {
    this.isMobileSearchOpen.set(false);
    this.isMobileMenuOpen.set(true);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  openMobileSearch(): void {
    this.isMobileMenuOpen.set(false);
    this.isMobileSearchOpen.set(true);
  }

  closeMobileSearch(): void {
    this.isMobileSearchOpen.set(false);
  }
}

/** Margen para alejarse del menú (por ejemplo, un temblor del ratón) sin cerrarlo. */
const OUTSIDE_TOLERANCE_PX = 24;

/** Distancia del puntero al rectángulo de la barra y su desplegable abierto. */
function distanceToMenu(menu: HTMLElement, x: number, y: number): number {
  const rects = [menu, ...Array.from(menu.querySelectorAll<HTMLElement>('.nav-dropdown'))]
    .map(element => element.getBoundingClientRect());
  return Math.min(...rects.map(rect => Math.hypot(
    Math.max(rect.left - x, 0, x - rect.right),
    Math.max(rect.top - y, 0, y - rect.bottom)
  )));
}

function sameIds(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  return a.size === b.size && [...a].every(id => b.has(id));
}
