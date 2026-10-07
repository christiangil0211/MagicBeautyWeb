import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface AdminNavItem {
  label: string;
  icon: string;
  path?: string;
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent {
  /** Los módulos sin `path` todavía no existen: se muestran para dar contexto del roadmap. */
  readonly navItems: AdminNavItem[] = [
    { label: 'Categorías', icon: 'pi pi-sitemap', path: '/admin/categories' },
    { label: 'Productos', icon: 'pi pi-shopping-bag', path: '/admin/products' },
    { label: 'Administradores', icon: 'pi pi-users', path: '/admin/users' },
    { label: 'Marcas', icon: 'pi pi-tag' },
    { label: 'Inventario', icon: 'pi pi-box' }
  ];

  readonly isSidebarOpen = signal(false);

  toggleSidebar(): void {
    this.isSidebarOpen.update(open => !open);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }
}
