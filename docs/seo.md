# SEO de la tienda pública

Cómo está resuelto el SEO de https://www.magicbeautycosmetics.com/, qué se verifica
solo y qué pasos manuales quedan fuera del repositorio.

## Cómo funciona

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Datos del negocio | `frontend/.../core/constants/store-contact.ts` | Única fuente de nombre, dirección, WhatsApp, correo, Maps y redes. La usan el pie de página y el JSON-LD. |
| Metadatos por página | `core/seo/seo.service.ts` | Título, descripción, robots, canonical, Open Graph, Twitter Cards y JSON-LD. Cada página reemplaza por completo los de la anterior. |
| Metadatos de cada ruta | `app.routes.ts` (`title` y `data.seo`) + `core/seo/seo-title.strategy.ts` | Se aplican en cada navegación. Un `noindex` en una ruta padre cubre a sus hijas. |
| Datos estructurados | `core/seo/structured-data.ts` | `Store` y `WebSite` en el inicio; `Product` y `BreadcrumbList` en la ficha; `BreadcrumbList` en la categoría. |
| Metadatos de marca sin JavaScript | `src/index.html` | Los recibe quien no ejecuta JavaScript (WhatsApp, Facebook) en cualquier URL. |
| Prerenderizado | `app.routes.server.ts` | `/`, `/catalogo` y `/catalogos` se generan como HTML en el build. |
| Rastreo | `public/robots.txt` | Permite todo salvo `/admin` y declara el sitemap. |
| Sitemap | API: `GET /sitemap.xml` (`SitemapController`, `SitemapService`) | Páginas del portal, categorías activas y productos activos, generado en cada consulta. |
| Hosting | `public/staticwebapp.config.json` | Fallback a `index.csr.html`, cabeceras `X-Robots-Tag` y caché. |

### Qué se indexa y qué no

- **Se indexan:** `/`, `/catalogo`, `/catalogos`, `/catalogo/categoria/:slug` y `/catalogo/:reference`.
- **No se indexan (`noindex`):** `/pedido`, el administrador, la tienda con sesión (`/inicio`,
  `/productos`, `/categoria/...`), las búsquedas internas (`?q=`), las direcciones que no existen
  y los productos o categorías que no existen.
- El canonical siempre apunta a `https://www.magicbeautycosmetics.com` y nunca lleva parámetros.
  Las páginas `noindex` no llevan canonical.

`/pedido` y las búsquedas **no** están en `robots.txt` a propósito: un buscador solo puede
leer la etiqueta `noindex` de una página que se le permite rastrear.

### Categorías

Cada categoría tiene página propia en `/catalogo/categoria/:slug`: es el catálogo digital con la
categoría ya marcada, con su propio título, encabezado, descripción y canonical. Los enlaces
anteriores (`/catalogo?categoria=slug` y `/categoria/slug`) redirigen a ella y conservan el resto
de parámetros. El pie de página enlaza las categorías del menú.

Una categoría sin productos activos (ni en sus subcategorías) no aparece en el sitemap y su
página se marca `noindex`: vuelve a indexarse sola en cuanto se le asignan productos desde el
administrador. Los productos sin categoría se indexan igual por su ficha.

### Renderizado

El sitio se publica como archivos estáticos en Azure Static Web Apps, sin servidor Node.

- Las tres páginas cuyo contenido no depende de la API se **prerenderizan** en el build. Su HTML
  ya trae encabezado, textos, metadatos y JSON-LD.
- Todo lo que sale de la API (listado de productos, menú, catálogos, sesión) se pide **solo en el
  navegador**. El build no llama a la API y no congela precios ni existencias.
- Las fichas de producto y las categorías se renderizan en el navegador. Google las procesa
  ejecutando JavaScript; WhatsApp y Facebook no, así que al compartir una ficha la vista previa
  muestra los datos de la marca, no los del producto. Prerenderizar las fichas lo resolvería,
  pero congelaría precios, por eso no se hace.

`staticwebapp.config.json` redirige las rutas de la aplicación a **`index.csr.html`**, no a
`index.html`: ese archivo es ahora la portada prerenderizada. Si se desactiva el prerenderizado
en `angular.json`, `index.csr.html` deja de generarse y hay que volver el fallback a `/index.html`.

### Direcciones que no existen

Azure Static Web Apps responde 200 a cualquier URL de la aplicación. Por eso la página "no
encontrado", el producto inexistente y la categoría inexistente se marcan `noindex`, que es lo
que Google recomienda para aplicaciones de una sola página.

## Verificación automática

- Frontend (`npm test`): `core/seo/*.spec.ts` cubre metadatos, canonical, Open Graph, datos
  estructurados, `robots.txt`, `staticwebapp.config.json`, `index.html` y qué rutas se prerenderizan.
- Backend (`dotnet test`): `SitemapTests.cs` cubre el contenido del sitemap, que nunca lista
  productos inactivos, y el endpoint de productos relacionados.

Validación externa pendiente tras desplegar (no se puede hacer sin el sitio publicado):

- [Prueba de resultados enriquecidos](https://search.google.com/test/rich-results) sobre `/` y una ficha.
- [Validador de Schema.org](https://validator.schema.org/).
- Depurador de Facebook o una vista previa en WhatsApp para la portada.

## Pasos manuales pendientes

### 1. Cloudflare y Azure: dominio raíz

Hoy `magicbeautycosmetics.com` (sin `www`) no resuelve. Para que redirija a `www`:

1. Azure Portal → Static Web App `mango-beach-053c1c010` → **Custom domains** → **Add** →
   *Custom domain on other DNS* → escribir `magicbeautycosmetics.com`.
2. Azure muestra un registro **TXT** de validación. Crearlo en Cloudflare → DNS con el nombre y
   el valor exactos que indique Azure, y esperar a que el dominio quede *Validated*.
3. En Cloudflare, crear un registro **CNAME** con nombre `@` y destino
   `mango-beach-053c1c010.4.azurestaticapps.net`, en modo **DNS only** (nube gris). Cloudflare lo
   aplana automáticamente en el dominio raíz.
4. En **Custom domains**, seleccionar `www.magicbeautycosmetics.com` → **Set default**. A partir de
   ahí el dominio raíz y el dominio `azurestaticapps.net` redirigen a `www`.

No tocar el CNAME actual de `www`. El plan gratuito admite dos dominios personalizados.

### 2. Google Search Console

1. Añadir una propiedad de tipo **Dominio** para `magicbeautycosmetics.com` y verificarla con el
   registro TXT que indique Google, en Cloudflare.
2. Inspeccionar `https://www.magicbeautycosmetics.com/` y **solicitar indexación**.
3. Inspeccionar una ficha (por ejemplo `/catalogo/ACE009`) con *Probar URL publicada* y revisar que
   el HTML renderizado muestre el producto, su título y los datos estructurados.

Depende de Search Console y no se puede comprobar desde el repositorio:

- Que Google renderice las fichas y categorías a tiempo. Si la inspección muestra la página vacía,
  la causa más probable es el arranque en frío de la API (ver riesgos).
- La lectura del sitemap. Está en el host de la API, así que Google lo descubre por `robots.txt`
  y no se puede enviar desde el formulario de la propiedad. Si se le da a la API un subdominio
  propio (por ejemplo `api.magicbeautycosmetics.com`), la propiedad de dominio lo cubre y se puede
  enviar. En ese caso hay que actualizar `environment.production.ts` y `robots.txt` a la vez: una
  prueba falla si no coinciden.
- Cuánto tarda la indexación y qué páginas elige Google.

### 3. Ficha de Google Maps

1. En el Perfil de Empresa, poner `https://www.magicbeautycosmetics.com/` como sitio web.
2. Comprobar que nombre, dirección y teléfono de la ficha coincidan con los del sitio.
3. Cuando estén confirmados el horario, el código postal y las coordenadas, añadirlos a
   `store-contact.ts` y a `buildStoreJsonLd`. Hoy no se publican porque no están confirmados.

### 4. Azure App Service (API)

- Revisar si el plan permite **Always On**. En las pruebas, la primera petición tras un rato sin
  uso tardó más de 20 segundos.
