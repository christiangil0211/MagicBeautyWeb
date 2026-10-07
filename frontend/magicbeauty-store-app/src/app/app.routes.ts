import { Routes } from '@angular/router';

import { adminGuard } from './core/guards/admin.guard';

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
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/public/home/home.component').then(m => m.HomeComponent),
        title: 'Magic Beauty Cosmetics'
      },
      {
        path: 'productos',
        loadComponent: () =>
          import('./features/public/products/products.component').then(m => m.ProductsComponent),
        title: 'Productos · Magic Beauty Cosmetics'
      },
      {
        path: 'productos/:reference',
        loadComponent: () =>
          import('./features/public/product-detail/product-detail.component').then(
            m => m.ProductDetailComponent
          )
      },
      {
        path: 'categoria/:slug',
        loadComponent: () =>
          import('./features/public/catalog/catalog.component').then(m => m.CatalogComponent)
      }
    ]
  },
  {
    // Marcas, Ofertas y Nuevo todavía no existen: evitamos que el router falle.
    path: '**',
    redirectTo: ''
  }
];
