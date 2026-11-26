/*
  Fase B — Marcas. 01: ESQUEMA. Se ejecuta ANTES de publicar el código de marcas.

  - Solo agrega columnas (NULL o con DEFAULT) y un índice, y vuelve nullable
    Products.BrandId. No borra ni renombra nada. El código que hoy está en
    producción sigue funcionando después de ejecutarlo.
  - Idempotente: revisa el esquema real antes de cada paso. Se puede ejecutar
    varias veces.
  - Llena el slug de las marcas existentes (solo los vacíos).
  - Registra la migración EF 20261126050958_ExpandBrands para que el historial
    del código y la base coincidan.

  Después: ejecuta 01-esquema-verificacion.sql. Si todo sale OK, se puede publicar.
*/
-- Requeridas por el índice filtrado (algunas herramientas, como sqlcmd, las traen apagadas).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO

-- 1) Products.BrandId acepta NULL (producto sin marca). El índice y la llave
--    foránea se conservan; el índice se recrea porque SQL Server no deja
--    cambiar la nulabilidad de una columna indexada.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'BrandId' AND is_nullable = 0)
BEGIN
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_BrandId')
        DROP INDEX [IX_Products_BrandId] ON [dbo].[Products];

    ALTER TABLE [dbo].[Products] ALTER COLUMN [BrandId] int NULL;

    CREATE INDEX [IX_Products_BrandId] ON [dbo].[Products] ([BrandId]);

    COMMIT;
END;
GO

-- 2) Columnas nuevas de Brands.
IF COL_LENGTH(N'dbo.Brands', N'Slug') IS NULL
    ALTER TABLE [dbo].[Brands] ADD [Slug] nvarchar(120) NULL;
IF COL_LENGTH(N'dbo.Brands', N'LogoUrl') IS NULL
    ALTER TABLE [dbo].[Brands] ADD [LogoUrl] nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.Brands', N'Description') IS NULL
    ALTER TABLE [dbo].[Brands] ADD [Description] nvarchar(300) NULL;
IF COL_LENGTH(N'dbo.Brands', N'IsFeatured') IS NULL
    ALTER TABLE [dbo].[Brands] ADD [IsFeatured] bit NOT NULL CONSTRAINT [DF_Brands_IsFeatured] DEFAULT CAST(0 AS bit);
IF COL_LENGTH(N'dbo.Brands', N'SortOrder') IS NULL
    ALTER TABLE [dbo].[Brands] ADD [SortOrder] int NOT NULL CONSTRAINT [DF_Brands_SortOrder] DEFAULT 0;
GO

-- 3) Slug de las marcas existentes (solo los vacíos): sin tildes, minúsculas y
--    guiones. "Kevin & Coco" → "kevin-coco"; "Ritual Botánico" → "ritual-botanico".
UPDATE b SET Slug = s.Slug
FROM dbo.Brands b
CROSS APPLY (SELECT LOWER(CAST(b.Name COLLATE SQL_Latin1_General_CP1253_CI_AI AS varchar(150))) AS Plain) p
CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(p.Plain,
    '&', ' '), '.', ' '), ',', ' '), '''', ' '), '/', ' '), '(', ' '), ')', ' '), '+', ' '), '_', ' '), '#', ' ') AS Spaced) a
CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(a.Spaced)), '  ', ' '), '  ', ' '), '  ', ' ') AS Single) c
CROSS APPLY (SELECT REPLACE(REPLACE(c.Single, ' ', '-'), '--', '-') AS Slug) s
WHERE b.Slug IS NULL OR b.Slug = '';

-- Si dos marcas quedan con el mismo slug, la segunda recibe su Id al final.
WITH Ranked AS (
    SELECT Id, Slug, ROW_NUMBER() OVER (PARTITION BY Slug ORDER BY Id) AS Position
    FROM dbo.Brands
    WHERE Slug IS NOT NULL)
UPDATE Ranked SET Slug = LEFT(Slug, 110) + '-' + CAST(Id AS varchar(10))
WHERE Position > 1;
GO

-- 4) Slug único (los NULL no cuentan).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Brands') AND name = N'IX_Brands_Slug')
    CREATE UNIQUE INDEX [IX_Brands_Slug] ON [dbo].[Brands] ([Slug]) WHERE [Slug] IS NOT NULL;
GO

-- 5) Historial de migraciones de EF.
IF NOT EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261126050958_ExpandBrands')
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261126050958_ExpandBrands', N'10.0.8');
GO
