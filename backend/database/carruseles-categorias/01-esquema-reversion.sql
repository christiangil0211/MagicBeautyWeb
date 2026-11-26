/*
  Carruseles de categorías. REVERSIÓN del 01. Solo si hay que volver atrás.

  Quita la columna Categories.ShowAsHomeCarousel (se pierde qué categorías
  tenían carrusel) y el registro de la migración. Antes hay que volver a
  publicar la versión anterior del API: el código nuevo usa la columna.
*/
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

DECLARE @constraint sysname = (
    SELECT d.name FROM sys.default_constraints d
    JOIN sys.columns c ON c.object_id = d.parent_object_id AND c.column_id = d.parent_column_id
    WHERE d.parent_object_id = OBJECT_ID(N'dbo.Categories') AND c.name = N'ShowAsHomeCarousel');

IF @constraint IS NOT NULL
    EXEC (N'ALTER TABLE [dbo].[Categories] DROP CONSTRAINT [' + @constraint + N']');

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Categories') AND name = N'ShowAsHomeCarousel')
    ALTER TABLE [dbo].[Categories] DROP COLUMN [ShowAsHomeCarousel];

DELETE FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261126163734_AddCategoryHomeCarousel';

COMMIT;
GO
