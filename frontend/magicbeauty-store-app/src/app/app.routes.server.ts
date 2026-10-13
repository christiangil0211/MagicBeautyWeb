import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * El sitio se publica como archivos estáticos (Azure Static Web Apps), sin
 * servidor Node. Solo se prerenderizan en el build las páginas cuyo HTML no
 * depende de la API: así llevan su contenido y sus metadatos sin JavaScript y
 * no congelan precios ni existencias. Lo que consultan (listado de productos,
 * catálogos, sesión) se pide siempre en el navegador.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'catalogo', renderMode: RenderMode.Prerender },
  { path: 'catalogos', renderMode: RenderMode.Prerender },
  {
    // Fichas, categorías, pedido y administrador dependen de datos vivos o de la sesión.
    path: '**',
    renderMode: RenderMode.Client
  }
];
