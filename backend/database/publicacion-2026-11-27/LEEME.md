# Publicación 2026-11-27: usuarios, banners del inicio y marcas

Base de datos de producción: 5 migraciones nuevas, todas posteriores a
`20261126190617_AddSaleInvoiceAmounts`. **No borran datos.** La migración de
clientes mueve el rol comercial de cada cliente de `UserRoles` a
`Users.CommercialRoleId`, y se aborta sola si los roles base no son los
esperados o si algún usuario tiene varios roles comerciales.

`01-migraciones.sql` es **todo o nada**: corre en una sola transacción y,
ante cualquier error, deshace todo y no ejecuta nada más (`SET NOEXEC`).
Es idempotente: si ya se aplicó, no cambia nada.

Este script reemplaza a `banners-inicio/01-esquema.sql`, porque ya incluye la
tabla de banners. No ejecutes los dos.

## Orden

| Paso | Qué | Dónde |
|---|---|---|
| 0 | Anotar la hora exacta (punto de restauración de Azure SQL) o crear una copia de la base | Portal de Azure |
| 1 | `00-verificacion-previa.sql`: todas las filas deben decir **OK** | Producción |
| 2 | `01-migraciones.sql`: debe terminar con **OK: las 5 migraciones quedaron aplicadas.** | Producción |
| 3 | `02-verificacion.sql`: todas las filas deben decir **OK** y los conteos deben coincidir con los del paso 1 | Producción |
| 4 | Fusionar el PR `develop → release`, que publica el API y el sitio | GitHub |
| 5 | Ya publicado: `banners-inicio/02-datos.sql` y luego `banners-inicio/02-datos-verificacion.sql` | Producción |

Entre el paso 2 y el final del paso 4 (unos minutos), los clientes con rol
comercial podrían ver precios al detal. El paso 1 muestra cuántos son.

Después de publicar, los administradores deben iniciar sesión de nuevo: las
sesiones ahora validan un sello de seguridad.

## Ensayo

Se ensayó sobre una copia de la base local con el mismo esquema que
producción y un cliente mayorista simulado:

- Las migraciones se aplican y el cliente conserva su rol.
- El esquema resultante es idéntico al que genera EF.
- Una segunda ejecución no cambia nada.
- Con un usuario con dos roles comerciales se detiene sin aplicar nada.

Generado con:
`dotnet ef migrations script 20261126190617_AddSaleInvoiceAmounts --idempotent`,
envuelto en una transacción única con guardianes entre lotes.
