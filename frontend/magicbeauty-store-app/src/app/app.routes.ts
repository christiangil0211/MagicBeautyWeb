import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanMatchFn, Router, Routes } from '@angular/router';

import { map } from 'rxjs';
import { AuthService } from './core/services/auth.service';

import { adminGuard } from './core/guards/admin.guard';
import { PORTAL_BANNERS } from './features/public/portal/portal-navigation';

const authenticatedStore: CanMatchFn = (_route, segments) => {
  if (!['inicio', 'categoria', 'productos'].includes(segments[0]?.path)) return false;
  return inject(AuthService).ensureSession().pipe(map(session => session.isAuthenticated));
};

export const routes: Routes = [
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/admin/categories/admin-categories.component').then(
            m => m.AdminCategoriesComponent
          ),
        title: 'Categorías · Magic Beauty'
      },
      {
        // 'nuevo' va antes que ':id' para que el router no lo tome como un identificador.
        path: 'products/nuevo',
        loadComponent: () =>
          import('./features/admin/products/admin-product-form.component').then(
            m => m.AdminProductFormComponent
          ),
        title: 'Nuevo producto · Magic Beauty'
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./features/admin/products/admin-product-form.component').then(
            m => m.AdminProductFormComponent
          ),
        title: 'Producto · Magic Beauty'
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/admin/products/admin-products.component').then(
            m => m.AdminProductsComponent
          ),
        title: 'Productos · Magic Beauty'
      },
      {
        path: 'catalogs',
        loadComponent: () =>
          import('./features/admin/catalogs/admin-catalogs.component').then(m => m.AdminCatalogsComponent),
        title: 'Catálogos tradicionales · Magic Beauty'
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/users/admin-users.component').then(m => m.AdminUsersComponent),
        title: 'Administradores · Magic Beauty'
      },
      {
        path: '',
        redirectTo: 'categories',
        pathMatch: 'full'
      }
    ]
  },
  {
    /*
     * Portal público: mientras se termina el e-commerce, la tienda se presenta en
     * cuatro pestañas. HomeComponent y CatalogComponent siguen en el código para
     * el e-commerce, pero sin ruta pública; sus URL antiguas redirigen al portal.
     */
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: 'inicio',
        canMatch: [authenticatedStore],
        loadComponent: () => import('./features/public/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: '',
        canMatch: [authenticatedStore],
        loadComponent: () => import('./layouts/store-layout/store-layout.component').then(m => m.StoreLayoutComponent),
        children: [
          {
            path: 'categoria/:slug',
            resolve: { categoria: (route: ActivatedRouteSnapshot) => route.paramMap.get('slug') },
            loadComponent: () => import('./features/public/digital-catalog/digital-catalog.component').then(m => m.DigitalCatalogComponent)
          },
          {
            path: 'productos',
            loadComponent: () => import('./features/public/digital-catalog/digital-catalog.component').then(m => m.DigitalCatalogComponent)
          },
          {
            path: 'productos/:reference',
            data: { quoteMode: true },
            loadComponent: () => import('./features/public/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
          }
        ]
      },
      {
        // Banner + pestañas. Cada pestaña declara su banner en `data.portalBanner`.
        path: '',
        loadComponent: () =>
          import('./features/public/portal/portal-shell.component').then(m => m.PortalShellComponent),
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./features/public/benefits/benefits.component').then(m => m.BenefitsComponent),
            title: 'Magic Beauty Cosmetics',
            data: { portalBanner: PORTAL_BANNERS.benefits }
          },
          {
            path: 'catalogo',
            loadComponent: () =>
              import('./features/public/digital-catalog/digital-catalog.component').then(
                m => m.DigitalCatalogComponent
              ),
            title: 'Catálogo digital · Magic Beauty Cosmetics',
            data: { portalBanner: PORTAL_BANNERS.digitalCatalog }
          },
          {
            path: 'catalogo/:reference',
            loadComponent: () =>
              import('./features/public/product-detail/product-detail.component').then(
                m => m.ProductDetailComponent
              ),
            // En el portal se cotiza: sin existencias ni topes por stock.
            data: { quoteMode: true }
          },
          {
            path: 'catalogos',
            loadComponent: () =>
              import('./features/public/traditional-catalogs/traditional-catalogs.component').then(
                m => m.TraditionalCatalogsComponent
              ),
            title: 'Catálogo tradicional · Magic Beauty Cosmetics',
            data: { portalBanner: PORTAL_BANNERS.traditionalCatalogs }
          },
          {
            path: 'pedido',
            loadComponent: () =>
              import('./features/public/order/order.component').then(m => m.OrderComponent),
            title: 'Mi pedido · Magic Beauty Cosmetics',
            data: { portalBanner: PORTAL_BANNERS.order }
          }
        ]
      },
      // Enlaces ya compartidos de la tienda anterior: conservan búsqueda y referencia.
      {
        path: 'productos',
        redirectTo: 'catalogo'
      },
      {
        path: 'productos/:reference',
        redirectTo: 'catalogo/:reference'
      },
      {
        // La categoría pasa a ser un filtro del catálogo digital.
        path: 'categoria/:slug',
        redirectTo: ({ params }) =>
          inject(Router).createUrlTree(['/catalogo'], { queryParams: { categoria: params['slug'] } })
      }
    ]
  },
  {
    // Rutas inexistentes (y las del e-commerce aún no publicadas) vuelven al inicio.
    path: '**',
    redirectTo: ''
  }
];
