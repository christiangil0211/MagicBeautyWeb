/*
  Carruseles de categorías en el inicio. 01: ESQUEMA. Se ejecuta ANTES de
  publicar el código.

  - Solo agrega la columna Categories.ShowAsHomeCarousel (bit, NOT NULL,
    DEFAULT 0): ninguna categoría queda con carrusel hasta que se encienda en
    Admin › Categorías. No borra ni renombra nada. El código que hoy está en
    producción sigue funcionando después de ejecutarlo.
  - Idempotente: revisa el esquema real antes de cada paso. Se puede ejecutar
    varias veces.
  - Registra la migración EF 20261126163734_AddCategoryHomeCarousel para que
    el historial del código y la base coincidan.

  Después: ejecuta 01-esquema-verificacion.sql. Si todo sale OK, se puede publicar.
*/
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

-- 1) Columna nueva, apagada para todas las categorías.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Categories') AND name = N'ShowAsHomeCarousel')
    ALTER TABLE [dbo].[Categories]
        ADD [ShowAsHomeCarousel] bit NOT NULL
        CONSTRAINT [DF_Categories_ShowAsHomeCarousel] DEFAULT CAST(0 AS bit);

-- 2) Historial de migraciones de EF.
IF NOT EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261126163734_AddCategoryHomeCarousel')
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261126163734_AddCategoryHomeCarousel', N'10.0.8');

COMMIT;
GO
