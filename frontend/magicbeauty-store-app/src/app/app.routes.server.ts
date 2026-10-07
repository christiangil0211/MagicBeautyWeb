import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // El administrador depende de datos vivos y no necesita SEO: se renderiza solo en el navegador.
    path: 'admin/**',
    renderMode: RenderMode.Client
  },
  {
    // La tienda sí necesita SEO, pero el menú cambia con el catálogo: SSR en cada petición, no prerender.
    path: '**',
    renderMode: RenderMode.Server
  }
];
