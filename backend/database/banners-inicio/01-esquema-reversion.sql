/*
  Banners del inicio. REVERSIÓN del 01. Solo si hay que volver atrás.

  Borra la tabla dbo.HomeBanners (se pierden los banners cargados desde el
  administrador; las imágenes quedan en el almacenamiento bajo home-banners/)
  y el registro de la migración. Antes hay que volver a publicar la versión
  anterior del API: el código nuevo usa la tabla.
  La tienda no se queda sin carrusel: usa los banners de respaldo del código.
*/
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.HomeBanners', N'U') IS NOT NULL
    DROP TABLE [dbo].[HomeBanners];

DELETE FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261127164347_AddHomeBanners';

COMMIT;
GO
