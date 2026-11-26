/*
  Fase B — Marcas. REVERSIÓN del 01. Solo si hay que volver atrás ANTES del 02.

  Requisito: no puede haber productos sin marca (BrandId NULL). Si el 02 ya se
  ejecutó, primero ejecuta 02-datos-reversion.sql. El script se detiene sin
  cambiar nada si encuentra productos sin marca.

  Ojo: borra el slug, el logo (la URL; el archivo queda en el Blob), la
  descripción, el orden y la marca de destacada de todas las marcas.
  Después hay que volver a publicar la versión anterior del API.
*/
-- Requeridas por el índice filtrado (algunas herramientas, como sqlcmd, las traen apagadas).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

IF EXISTS (SELECT 1 FROM dbo.Products WHERE BrandId IS NULL)
BEGIN
    RAISERROR(N'Hay productos sin marca: ejecuta primero 02-datos-reversion.sql. No se cambió nada.', 16, 1);
    SET NOEXEC ON;
END;
GO

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Brands') AND name = N'IX_Brands_Slug')
    DROP INDEX [IX_Brands_Slug] ON [dbo].[Brands];

IF OBJECT_ID(N'dbo.DF_Brands_IsFeatured', N'D') IS NOT NULL ALTER TABLE [dbo].[Brands] DROP CONSTRAINT [DF_Brands_IsFeatured];
IF OBJECT_ID(N'dbo.DF_Brands_SortOrder', N'D') IS NOT NULL ALTER TABLE [dbo].[Brands] DROP CONSTRAINT [DF_Brands_SortOrder];

IF COL_LENGTH(N'dbo.Brands', N'Slug') IS NOT NULL ALTER TABLE [dbo].[Brands] DROP COLUMN [Slug];
IF COL_LENGTH(N'dbo.Brands', N'LogoUrl') IS NOT NULL ALTER TABLE [dbo].[Brands] DROP COLUMN [LogoUrl];
IF COL_LENGTH(N'dbo.Brands', N'Description') IS NOT NULL ALTER TABLE [dbo].[Brands] DROP COLUMN [Description];
IF COL_LENGTH(N'dbo.Brands', N'IsFeatured') IS NOT NULL ALTER TABLE [dbo].[Brands] DROP COLUMN [IsFeatured];
IF COL_LENGTH(N'dbo.Brands', N'SortOrder') IS NOT NULL ALTER TABLE [dbo].[Brands] DROP COLUMN [SortOrder];

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'BrandId' AND is_nullable = 1)
BEGIN
    DROP INDEX [IX_Products_BrandId] ON [dbo].[Products];
    ALTER TABLE [dbo].[Products] ALTER COLUMN [BrandId] int NOT NULL;
    CREATE INDEX [IX_Products_BrandId] ON [dbo].[Products] ([BrandId]);
END;

DELETE FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261126050958_ExpandBrands';

COMMIT;
GO

SET NOEXEC OFF;
GO
