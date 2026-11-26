# Integración Alegra

Actualiza los productos de la tienda con los ítems de Alegra. Por ahora corre
**bajo demanda**: el administrador pulsa "Actualizar desde Alegra" en
Admin › Productos.

## Qué hace

### Cruce por id de Alegra

Cada producto queda asociado a su ítem de Alegra en la tabla `alegra.ProductLinks`
(producto ↔ id de Alegra). El id de Alegra nunca cambia, así que el cruce sobrevive a
cambios de referencia en Alegra.

- **Primera vez** que llega un ítem: se asocia al producto con la **misma referencia**
  (3 letras y 3 números, sin distinguir mayúsculas) o, si no existe, se crea.
- **Desde ahí**: se cruza solo por id. La referencia de Alegra deja de importar.
- Si dos ítems de Alegra tienen la misma referencia, solo el primero se asocia; el otro
  se reporta para que lo corrijan en Alegra.
- Si un producto se borra en la tienda, su vínculo se descarta en la siguiente corrida.

### Velocidad

Se compara primero contra el listado de la tienda (nombre, estado, existencias y precio
predeterminado) y contra la huella de la última descripción traída de Alegra. El detalle
de un producto solo se carga cuando algo difiere.

### Datos

| Dato | Comportamiento |
|---|---|
| Nombre y descripción | Se sobrescriben si Alegra trae un valor (si viene vacío, se conserva el de la tienda). |
| Estado | `inactive` en Alegra desactiva el producto; `active` lo activa. |
| Precio | El de la lista `PriceListId` reemplaza el tipo de precio `PriceTypeCode` (vacío = el predeterminado). Los demás tipos de precio se conservan. |
| Inventario | La existencia de la variante única queda igual a `availableQuantity` de Alegra, con un movimiento `ADJUSTMENT` ("Sincronización con Alegra"). Los productos **con tonos** no se tocan (se avisa en el resumen). |
| Referencias nuevas | Se crean **inactivas**, sin tonos y **sin marca** (`BrandId` NULL), para que el administrador les ponga marca, categorías e imágenes. |
| Marca | La decide solo la tienda (Admin › Marcas o la ficha del producto). La sincronización **nunca crea ni cambia** una marca. |

Se omiten (y se reportan) los ítems sin referencia, con un formato de referencia
distinto al de la tienda o repetidos. Un error en un producto no detiene a los demás.
Solo corre una actualización a la vez.

Los datos de la tienda pasan por los servicios de `Application` (`IProductService`,
`IBrandService`, `IPriceTypeService`): la integración no toca las tablas ni las entidades
de la tienda. Lo único que guarda es su propia tabla de vínculos, en el esquema `alegra`.

### Marca (a futuro)

Alegra hoy no trae la marca del ítem. Si en el futuro la trajera, **solo se usaría para llenar
la marca cuando el producto no tenga una** (`BrandId` NULL). Nunca reemplazaría la marca que
la tienda ya asignó. No está implementado: queda anotado como regla para cuando exista.


## Base de datos (esquema `alegra`)

La integración tiene su propio `AlegraDbContext`, en el esquema `alegra` y con su propio
historial de migraciones (`alegra.__EFMigrationsHistory`), sin llaves foráneas hacia `dbo`.

Aplicar la migración (desde `backend/`):

```powershell
# Desarrollo: directo contra tu base (la misma cadena DefaultConnection del API)
dotnet ef database update --project src/MagicBeauty.Store.Integrations.Alegra --startup-project src/MagicBeauty.Store.Integrations.Alegra --context AlegraDbContext --connection "<cadena de conexión>"

# Producción: script idempotente para revisarlo y ejecutarlo en Azure SQL
dotnet ef migrations script --idempotent --project src/MagicBeauty.Store.Integrations.Alegra --startup-project src/MagicBeauty.Store.Integrations.Alegra --context AlegraDbContext -o alegra.sql
```

Nuevas migraciones de la integración:

```powershell
dotnet ef migrations add <Nombre> --project src/MagicBeauty.Store.Integrations.Alegra --startup-project src/MagicBeauty.Store.Integrations.Alegra --context AlegraDbContext --output-dir Persistence/Migrations
```

## Configuración

Sección `Integrations:Alegra` (en Azure: `Integrations__Alegra__Token`, etc.):

```json
"Integrations": {
  "Alegra": {
    "Enabled": true,
    "Email": "correo-de-la-cuenta@alegra",
    "Token": "token-de-la-api",
    "PriceListId": 1,
    "PriceTypeCode": ""
  }
}
```

El correo y el token son secretos: van en `appsettings.{Ambiente}.json` (no
versionado) o en la configuración de la App Service, nunca en el repositorio.
Con `Enabled: false` o sin credenciales, el botón no aparece y el endpoint responde 404.

## Endpoints (solo administradores)

- `GET  /api/integrations/alegra/status` → `{ "enabled": true }`
- `POST /api/integrations/alegra/products/sync` → resumen (`total`, `created`, `updated`,
  `unchanged`, `skipped`, `failed`, `issues[]`). 409 si ya hay una en curso, 502 si Alegra falla.

## Cómo retirarla

1. Backend: borrar esta carpeta, su línea en `MagicBeauty.Store.slnx`, la referencia en
   `MagicBeauty.Store.Api.csproj` y las dos líneas de `Program.cs`
   (`AddAlegraIntegration` y `MapAlegraIntegration`). Borrar `AlegraIntegrationTests.cs`.
2. Frontend: borrar `src/app/integrations/alegra/` y quitar `<app-alegra-sync-button>`
   (y su import) de la pantalla de productos.
3. Quitar la sección `Integrations:Alegra` de la configuración.
4. Base de datos: `DROP TABLE alegra.ProductLinks; DROP TABLE alegra.__EFMigrationsHistory; DROP SCHEMA alegra;`
   (no afecta ninguna tabla de la tienda).
