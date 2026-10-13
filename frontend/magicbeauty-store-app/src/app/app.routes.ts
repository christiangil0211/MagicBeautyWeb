import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, CanMatchFn, Router, Routes } from '@angular/router';

import { map } from 'rxjs';
import { AuthService } from './core/services/auth.service';

import { adminGuard } from './core/guards/admin.guard';
import { SEO_DEFAULTS, SeoRouteData } from './core/seo/seo.model';
import { buildStoreJsonLd, buildWebSiteJsonLd } from './core/seo/structured-data';
import { PORTAL_BANNERS } from './features/public/portal/portal-navigation';

const authenticatedStore: CanMatchFn = (_route, segments) => {
  if (!['inicio', 'categoria', 'productos'].includes(segments[0]?.path)) return false;
  return inject(AuthService).ensureSession().pipe(map(session => session.isAuthenticated));
};

/**
 * Los enlaces antiguos `/catalogo?categoria=slug` pasan a la página propia de la
 * categoría, que es la que se indexa; el resto de parámetros se conserva.
 */
const categoryQueryToPage: CanActivateFn = route => {
  const { categoria: slug, ...queryParams } = route.queryParams;

  return slug ? inject(Router).createUrlTree(['/catalogo/categoria', slug], { queryParams }) : true;
};

/** Zonas privadas o sin valor para buscadores: nunca se indexan. */
const NO_INDEX: { seo: SeoRouteData } = { seo: { noindex: true } };

const CATALOG_SEO: SeoRouteData = {
  description:
    'Catálogo digital de Magic Beauty Cosmetics en Cali: maquillaje, cuidado capilar, facial y corporal al detal y al por mayor. Arma tu pedido por WhatsApp.',
  // Las búsquedas internas (?q=) no aportan páginas propias.
  noindexQueryParams: ['q']
};

export const routes: Routes = [
  {
    path: 'admin',
    canActivate: [adminGuard],
    data: NO_INDEX,
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
        data: NO_INDEX,
        loadComponent: () => import('./features/public/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: '',
        canMatch: [authenticatedStore],
        // Tienda con sesión: sus páginas públicas equivalentes viven en el portal.
        data: NO_INDEX,
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
            title: SEO_DEFAULTS.title,
            data: {
              portalBanner: PORTAL_BANNERS.benefits,
              seo: {
                description: SEO_DEFAULTS.description,
                jsonLd: { store: buildStoreJsonLd(), website: buildWebSiteJsonLd() }
              } satisfies SeoRouteData
            }
          },
          {
            path: 'catalogo',
            canActivate: [categoryQueryToPage],
            loadComponent: () =>
              import('./features/public/digital-catalog/digital-catalog.component').then(
                m => m.DigitalCatalogComponent
              ),
            title: 'Catálogo digital de maquillaje y cosméticos · Magic Beauty Cosmetics',
            data: { portalBanner: PORTAL_BANNERS.digitalCatalog, seo: CATALOG_SEO }
          },
          {
            // Página propia de cada categoría: el mismo catálogo con la categoría ya filtrada.
            path: 'catalogo/categoria/:slug',
            resolve: { categoria: (route: ActivatedRouteSnapshot) => route.paramMap.get('slug') },
            loadComponent: () =>
              import('./features/public/digital-catalog/digital-catalog.component').then(
                m => m.DigitalCatalogComponent
              ),
            title: 'Catálogo digital · Magic Beauty Cosmetics',
            data: { portalBanner: PORTAL_BANNERS.digitalCatalog, categoryPage: true, seo: CATALOG_SEO }
          },
          {
            path: 'catalogo/:reference',
            loadComponent: () =>
              import('./features/public/product-detail/product-detail.component').then(
                m => m.ProductDetailComponent
              ),
            title: 'Producto · Magic Beauty Cosmetics',
            // En el portal se cotiza: sin existencias ni topes por stock.
            data: { quoteMode: true }
          },
          {
            path: 'catalogos',
            loadComponent: () =>
              import('./features/public/traditional-catalogs/traditional-catalogs.component').then(
                m => m.TraditionalCatalogsComponent
              ),
            title: 'Catálogos en PDF · Magic Beauty Cosmetics',
            data: {
              portalBanner: PORTAL_BANNERS.traditionalCatalogs,
              seo: {
                description:
                  'Explora los catálogos tradicionales de Magic Beauty Cosmetics: míralos en línea o descárgalos en PDF con nuestras líneas de maquillaje y cosméticos.'
              } satisfies SeoRouteData
            }
          },
          {
            path: 'pedido',
            loadComponent: () =>
              import('./features/public/order/order.component').then(m => m.OrderComponent),
            title: 'Mi pedido · Magic Beauty Cosmetics',
            // El pedido es personal y vive en el navegador de cada visitante.
            data: { portalBanner: PORTAL_BANNERS.order, ...NO_INDEX }
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
        // La categoría de la tienda anterior tiene su página en el catálogo digital.
        path: 'categoria/:slug',
        redirectTo: '/catalogo/categoria/:slug'
      },
      {
        // Sin sesión, el inicio de la tienda es el portal.
        path: 'inicio',
        redirectTo: ''
      },
      {
        /*
         * Rutas inexistentes: una página propia marcada `noindex` en vez de volver
         * al inicio, para que los buscadores no las tomen por copias de la portada.
         */
        path: '**',
        loadComponent: () =>
          import('./features/public/not-found/not-found.component').then(m => m.NotFoundComponent),
        title: 'Página no encontrada · Magic Beauty Cosmetics',
        data: NO_INDEX
      }
    ]
  }
];
