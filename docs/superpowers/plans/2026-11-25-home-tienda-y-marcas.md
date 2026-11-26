# Home de tienda, mayoristas y marcas — plan

Estado: **aprobado con ajustes** (25-nov-2026). Fase A en curso; fase B espera la aprobación del mapeo.

## 0. Decisiones aprobadas

- **Alegra y la marca:** la marca la decide solo la tienda; la sincronización con Alegra nunca la crea ni la sobrescribe. *Pendiente a futuro (no implementar ahora):* si Alegra llega a traer marca, solo se usa para llenarla cuando el producto no tenga una.
- **"Sin marca" → `BrandId NULL`:**
  - Todo lo que hoy supone que la marca existe (tarjetas, fichas, filtros, catálogo PDF, JSON-LD, exportaciones, Alegra) debe soportar `NULL`. En la interfaz no se muestra "SIN MARCA": la marca simplemente no aparece.
  - El JSON-LD `Product` omite `brand` si es `NULL`.
  - Orden: el script de esquema va antes de publicar; el `UPDATE` "Sin marca" → `NULL` y la desactivación de esa marca van **después** de publicar el código que soporta `NULL`.
  - Los 53 productos con la marca en el nombre entran al mapeo como propuesta, para aprobarlos uno por uno.
- **C2 corregido:** en los favoritos del home la marca **no** es obligatoria. Requisitos: foto, precio y no estar agotado. Los accesorios sin marca sí pueden salir.
- **Scripts de base de datos:**
  - Solo agregan tablas y columnas (sin `DROP`, `RENAME` ni cambios de tipo), son idempotentes y cada uno trae su script de reversión.
  - Las columnas nuevas en tablas existentes son `NULL` o tienen `DEFAULT`.
  - Antes de cada publicación se entregan el script, una consulta de verificación y el orden exacto (script → publicar → script de datos, si aplica).
  - Excepción ya aprobada: `Products.BrandId` pasa a nullable en la fase B.
- **Tablas de contenido:** evaluar una sola tabla de bloques del home frente a varias parecidas; decidir y justificar en el PR.
- **Fase A:** cinco pestañas en la barra inferior del celular; "Agregar" del home al pedido real; verificar en producción, sin sesión, que no aparece el menú de administración.

## 1. Lo que encontré en el código

| Tema | Situación actual | Consecuencia para el plan |
|---|---|---|
| `/` | `BenefitsComponent` ("¿Por qué ser mayorista…?") dentro del portal de 4 pestañas. | Se mueve a `/mayoristas`. |
| `/inicio` | Ya **no existe** como página: en la publicación anterior (SEO técnico) pasó a `/mi-tienda` (solo con sesión, `noindex`) y `/inicio` ya responde **301 → /** desde el hosting. | A3 está hecho del lado del hosting. Falta hacer que `/` sea el home de tienda. |
| Home de tienda | `HomeComponent`: categorías destacadas, 5 "favoritos" (los 5 primeros del catálogo, sin criterio), 2 bloques fijos ("Brilla con confianza", "Ahorra más"), franja de beneficios. Enlaza a `/productos` y `/categoria/...` (rutas con sesión) y sus botones de carrito son de prueba. | Hay que adaptarlo al público: enlaces a `/catalogo/...` y "Agregar" al pedido real (`OrderDraftService`), como ya hace el catálogo. |
| Menú de administración | El menú superior solo se pinta con sesión; "Gestionar y administrar" y "Administrar tienda" (pie) ya exigen `canManageStore()`. | A7 parece cumplido para visitantes sin sesión. Lo verifico en producción sin sesión. Si lo viste estando con tu sesión, es lo esperado. |
| Carrusel | 4 banners en código (`home-slides.ts`); el del calendario ya va primero. Pausa con mouse y con foco de teclado. Sin botón de pausa ni flechas. El bloque bajo la imagen cambia de alto según el banner, lo que **desplaza el contenido** (CLS). | A6: flechas, pausa y alto reservado. La configuración desde el admin necesita una tabla (ver fase C). |
| Marcas | **Ya existe** la entidad `Brand` (Id, Name, IsActive, CreatedAt, UpdatedAt) y `Product.BrandId` es **obligatorio** (`int`, FK Restrict). Hay CRUD en el API (`/api/brands`, solo admin), pero no hay pantalla de admin. | B no crea la entidad: la **amplía**. |
| Marca desde Alegra | Alegra **no trae marca** en la integración actual: los productos nuevos se crean con la marca `DefaultBrandName` = "Sin marca" y la sincronización nunca toca `BrandId`. | La pregunta de B3 se reduce a qué hacer si a futuro se quiere leer la marca de Alegra. |
| Datos de marcas (base local, copia de desarrollo) | 53 marcas, **sin duplicados** por mayúsculas o tildes. **764 de 1.559 productos** están en "Sin marca" (619 activos, 498 activos con foto). La mayoría son accesorios sin marca real (bolsos, diademas, cauchos, empaques). Unos **53** tienen el nombre de una marca existente dentro del nombre del producto (p. ej. "MANTEQUILLA CORPORAL WATER MELON **PURPURE**"). | El mapeo de normalización se saca de **producción**, no de la copia local (ver B2). |
| Categorías | Ya tienen `HomeImageUrl` y `ShowInHome` administrables, con subida a Blob. | C1 casi no necesita base de datos: falta excluir las categorías sin productos y limitar a 8. |
| Migraciones | El API **no** aplica migraciones al arrancar, y `release` despliega API y frontend a la vez. | Cada script SQL se ejecuta **antes** de publicar a `release`, y todo cambio de esquema debe ser compatible con el código anterior (columnas nuevas con valor por defecto, tablas nuevas). |

## 2. Orden de trabajo y ramas

| Rama | Contenido | ¿Base de datos? | Aprobación |
|---|---|---|---|
| `feature/home-tienda` | Fase A completa (salvo la configuración del carrusel desde el admin). | No | Directo |
| `feature/contenido-home` | Fase C + configuración del carrusel (A6). | Sí: tablas nuevas, script `contenido-home.sql` | Te paso el script antes de publicar |
| `feature/marcas` | Fase B. | Sí: script de esquema + script de datos (mapeo) | **Espera tu aprobación** |

Cada rama: commits por tema → PR a `develop` (vista previa con capturas a 375 px y 1440 px) → PR `develop → release`.

Secuencia de publicación con base de datos: (1) te entrego el script idempotente, (2) lo ejecutas en Azure SQL, (3) publico a `release`. Los scripts de esquema son aditivos, así que el sitio actual sigue funcionando entre el paso 2 y el 3.

## 3. Fase A — Reorganizar el home (sin base de datos)

### Rutas y navegación
- `app.routes.ts`
  - `''` → `HomeComponent` (público, `index,follow`, canonical `https://www.magicbeautycosmetics.com/`, JSON-LD `Store` + `WebSite`).
  - `mayoristas` → `BenefitsComponent`, con título, descripción y canonical propios y `BreadcrumbList`.
  - `mi-tienda` → redirige a `/` (con o sin sesión): ya no hace falta un inicio aparte.
- `portal-navigation.ts`: las pestañas quedan **Inicio · Catálogo · Catálogos · Mayoristas · Mi pedido**. El ítem "Hazte mayorista" del menú apunta a `/mayoristas` y solo se marca activo ahí; se elimina `isPortalUrl`.
- Enlaces internos: el logo (`/mi-tienda` → `/`), el admin (`admin-layout`), el retorno tras iniciar sesión (`account-panel`), el pie y el menú móvil.
- `staticwebapp.config.json`: `/inicio` ya es 301; se agrega `/mi-tienda` → 301 `/`.
- `app.routes.server.ts`: se prerenderizan `/` y `/mayoristas`.
- Sitemap (`SitemapService.PortalPaths`): se agrega `/mayoristas`. `/inicio` no está y sigue sin estar.

### Títulos y H1
- Home: título "Tienda de maquillaje y cosméticos en Cali | Magic Beauty Cosmetics"; un solo H1 fijo, "Tienda de maquillaje y cosméticos en Cali", bajo el carrusel.
- Los títulos de los banners del carrusel quedan como `<p>`. Se elimina la variante en que el banner hacía de H1.
- `/mayoristas`: título "Maquillaje y cosméticos al por mayor en Cali | Magic Beauty Cosmetics" y H1 "Maquillaje y cosméticos al por mayor en Cali".

### Home público (`HomeComponent`)
- Enlaces a `/catalogo/:ref` y `/catalogo/categoria/:slug`. "Agregar" va al pedido real, igual que en el catálogo.
- Los bloques vacíos dejan de mostrarse a visitantes (los mensajes de "marca una categoría…" solo los ve un administrador).
- Las secciones de la fase C se agregan en `feature/contenido-home`. En A queda el esqueleto: hero, H1, categorías, favoritos, franja de mayoristas (C8, estática), Visítanos en Cali (C5 con NAP, horario y mapa; la foto llega en C), beneficios y WhatsApp.

### Carrusel (A6, parte sin base de datos)
- Botones anterior y siguiente, y botón **pausar/reanudar** (requisito WCAG 2.2.2 para contenido que rota solo), con `aria-live="off"` durante la rotación y `polite` en pausa.
- Pausa con el mouse, con el foco (cualquier foco, no solo teclado) y con `prefers-reduced-motion`.
- Alto reservado en el bloque bajo la imagen, para que cambiar de banner no mueva la página.
- `fetchpriority="high"` solo en la primera imagen. Las demás se precargan después de la carga.
- Modelo listo para "slide destacado con fechas": si el destacado está vigente, va primero y el carrusel arranca en él. La configuración desde el admin llega con la fase C.

### Pruebas y verificación de A
- Pruebas: rutas (`/`, `/mayoristas`, `/mi-tienda`), SEO de rutas (títulos, canonical, un H1), estático (prerender y sitemap), carrusel (pausa, flechas, orden del destacado) y `SitemapTests`.
- Verificación: `curl` de `/`, `/mayoristas` y `/inicio`; Chrome a 375 px y 1440 px sin errores; Lighthouse móvil antes y después.

## 4. Fase C — Secciones del home (con base de datos)

### Modelo de datos (esquema `dbo`, una migración `AddHomeContent`)

| Tabla / columna | Campos | Para |
|---|---|---|
| `Products.IsFeatured` (bit, default 0) y `Products.FeaturedOrder` (int, null) | — | C2 |
| `HomeSlideSettings` | `SlideKey` (PK, id del banner en código), `IsFeatured`, `FeaturedFrom`, `FeaturedUntil`, `IsActive`, `SortOrder` | A6: destacado y fechas por banner. Los banners siguen siendo imágenes del código porque sus botones están dibujados en la imagen. |
| `HomeBanners` | `Id`, `Slot` (`promo-1`, `promo-2`), `ImageUrl`, `Title`, `Text`, `LinkUrl`, `LinkLabel`, `IsActive`, fechas | C7 |
| `StoreReviews` | `Id`, `AuthorName`, `Rating` (1–5), `Text` (≤ 600), `ReviewDate`, `IsActive`, `SortOrder`, fechas | C4 |
| `InstagramPosts` | `Id`, `ImageUrl`, `PostUrl` (solo `https://www.instagram.com/...`), `AltText`, `IsActive`, `SortOrder`, fechas | C6 |
| `StoreSettings` (una fila) | `StorePhotoUrl`, `StorePhotoAlt`, `GoogleRating` (decimal 2,1), `GoogleReviewCount`, `GoogleMapsUrl` | C4 y C5 |

### API
- Público:
  - `GET /api/home`: todo el home en **una sola llamada** (categorías, favoritos, marcas destacadas, banners, reseñas, Instagram, ajustes de tienda, slides), con caché de 5 minutos en memoria.
- Admin (`StoreAdmin`): CRUD + subida a Blob con las reglas actuales de `ImageUploadRules`:
  - `/api/admin/home/banners`, `/reviews`, `/instagram`, `/settings`, `/slides`.
  - `PUT /api/products/{id}/featured`.

### Reglas
- **C1:** categorías `ShowInHome` activas, con imagen y con al menos un producto activo (también en sus subcategorías), máximo 8. Las imágenes se administran en Admin › Categorías, como hoy.
- **C2:**
  - Selección: primero los productos marcados como destacados y luego un respaldo automático (los más recientes con datos completos), de 8 a 12 en total.
  - Requisitos de cada producto: activo, con foto y con precio detal > 0. La marca no es obligatoria.
  - Se excluye `AvailableQuantity <= 0`. Solo se excluye del home: fichas y catálogo siguen igual.
  - Máximo 2 por categoría.
- **C4:** "5,0 ★ en Google · N reseñas" solo si cargaste la calificación y el número en el admin, con enlace a `GoogleMapsUrl`. Las reseñas individuales solo salen si las cargas. No se usa la Places API.
- **C5:** foto del local (si existe), dirección, horario y WhatsApp desde `store-contact.ts`, botón "Cómo llegar" y un `iframe` de Google Maps sin API key con `loading="lazy"`.
- **C6:** de 4 a 6 publicaciones con imagen en Blob y enlace a la publicación, más el botón "Síguenos" hacia `@magicbeautycosmeticscali`. Sin scripts de Instagram.
- **C7:** cada promo se muestra solo si tiene imagen, título y enlace.

### Admin
Nueva sección "Inicio de la tienda" con pestañas Banners del carrusel · Promos · Reseñas · Instagram · Tienda. El destacado de productos va como interruptor en Admin › Productos.

## 5. Fase B — Marcas (**espera aprobación**)

### B1 / B2. Migración
- `Brands` + columnas nuevas:
  - `Slug` (nvarchar 120, único), `LogoUrl`, `Description` (≤ 300).
  - `IsFeatured` (bit, 0) y `SortOrder` (int, 0).
  - El slug se calcula para las marcas existentes en el mismo script.
- `Products.BrandId` pasa a **nullable**: "sin marca" deja de ser una marca y queda como `NULL`.
- **Script 1, esquema (antes de publicar):** columnas e índice único de `Slug`, y `BrandId` nullable. Es compatible con el código actual.
- **Script 2, datos (después de publicar):**
  - Fusiona las variantes de nombre según el mapeo aprobado.
  - Mueve los productos de "Sin marca" a `NULL`, salvo los que el mapeo asigna a una marca, y desactiva "Sin marca".
  - Va después porque el código actual no acepta `BrandId` nulo.
- **Mapeo revisable:** te paso un `SELECT` de solo lectura para ejecutar en Azure SQL (marcas con su conteo, nombres que coinciden sin mayúsculas ni tildes, y productos "Sin marca" cuyo nombre contiene una marca). Con su resultado armo `mapeo-marcas.csv` (nombre actual → marca final) para que lo revises antes de generar el script 2.
- Normalización y slug en el dominio (`BrandName.Normalize`, `Slug.From`) con pruebas unitarias. Se reutilizan para las categorías.

### B3. Admin › Marcas
- Listado con búsqueda, crear y editar.
- Desactivar en lugar de borrar cuando la marca tiene productos.
- Logo PNG/SVG/WebP de hasta 1 MB. Los SVG se validan sin scripts ni referencias externas.
- Orden y destacada.
- Selector de marca con búsqueda en Admin › Productos, con opción "Sin marca".
- **Alegra:** hoy no trae marca. Propuesta: **la marca la decide la tienda**; Alegra nunca la sobrescribe y los productos nuevos de Alegra llegan sin marca (`NULL`). Pregunta abierta, abajo.

### B4. API pública
- `GET /api/marcas`: activas, con logo, ordenadas.
- `GET /api/marcas/{slug}?page=&pageSize=`: marca y productos **completos**; 404 si no existe o está inactiva.

### B5 / B6. Páginas
- `/marcas`: grilla de logos.
- `/marcas/{slug}`:
  - Logo, nombre, descripción, la grilla del catálogo filtrada por marca y filtros básicos.
  - Título "{Marca} en Cali al detal y por mayor | Magic Beauty", canonical, `CollectionPage` + `BreadcrumbList`.
- **HTML para Google:** se agregan las reglas `/marcas` y `/marcas/*` → `/api/seo-page` en `staticwebapp.config.json`, con nuevos tipos `brands` y `brand` en `seo-page.js`. Mismas reglas de 200, 404 y 503 que las fichas.
- **Sitemap:** `/marcas` y `/marcas/{slug}` de marcas activas con al menos un producto completo.

### B7. Carrusel de logos
- Solo marcas destacadas con logo, en escala de grises y a color al pasar el mouse o con foco, con `loading="lazy"`.
- Se recorre con teclado (lista desplazable con flechas, sin animación infinita).

### B8. Pruebas
- Unitarias: normalización y slug.
- Integración: `/api/marcas`, `/api/marcas/{slug}` (200, 404, solo completos) y sitemap.
- Componente: carrusel de logos (sin logo no aparece, enlaces, teclado).
- Función: `seo-page` con marcas.

## 6. Riesgos

1. **Orden de publicación con base de datos:** si se publica el API antes de ejecutar el script, las consultas de productos fallan (500). Mitigación: scripts aditivos, idempotentes, que se ejecutan antes, más la verificación del paso 2 antes de fusionar a `release`.
2. **"Sin marca" a `NULL`:** el código actual asume marca obligatoria (formulario de admin, `ProductService.EnsureBrandExistsAsync`, Alegra). Por eso el script de datos va después de publicar el código que acepta `NULL`.
3. **El home deja de ser el de mayoristas:** quienes entran por Google buscando "por mayor" llegarán a `/`. Mitigación: franja de mayoristas visible en el primer pantallazo de móvil y `/mayoristas` en el sitemap con su propio título. Search Console tardará unas semanas en reflejar el cambio de contenido de `/`.
4. **Rendimiento:** el home pasa de 1 a 1 + `GET /api/home` llamadas, con mapa, reseñas, Instagram y logos. Mitigación: una sola llamada, todo lo que queda bajo el primer pantallazo con lazy-load, el `iframe` del mapa solo al acercarse, alto reservado por sección y Lighthouse móvil antes y después.
5. **Contenido vacío:** sin datos cargados, las secciones C4, C6 y C7 no se muestran. El home se ve bien sin ellas, pero lucirá más cuando cargues el contenido (lista al final).
6. **5 pestañas en móvil:** la barra inferior pasa de 4 a 5 ítems (unos 75 px cada uno a 375 px). Lo reviso en capturas.

## 7. Preguntas abiertas
1. **(B3) Alegra y la marca:** ¿confirmas que la marca la decide solo la tienda y Alegra nunca la cambia?
2. **(B2) "Sin marca":** ¿de acuerdo con que los accesorios sin marca queden sin marca (`NULL`) y no aparezcan en `/marcas`?

## 8. Lo que tendrás que cargar en el admin
- Logos de las marcas destacadas (PNG, SVG o WebP, fondo transparente, ancho ≥ 300 px).
- Imagen del inicio de 6 a 8 categorías (Admin › Categorías › "Imagen del inicio").
- Foto del local (fachada o interior, horizontal, ≥ 1200 px).
- Calificación y número de reseñas de Google, y URL de la ficha de Maps.
- Reseñas reales copiadas de Google (texto, nombre o inicial, estrellas y fecha).
- De 4 a 6 publicaciones de Instagram (imagen y enlace).
- Las 2 promos (imagen, título, texto y enlace), p. ej. combos y mayoristas.
- Productos destacados (interruptor en Admin › Productos).
