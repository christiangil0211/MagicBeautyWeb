/*
  Fase B — Marcas. Verificación del 01 (solo lectura). Cada fila debe decir OK.
*/
SET NOCOUNT ON;

SELECT Chequeo, CASE WHEN Correcto = 1 THEN 'OK' ELSE 'FALLA' END AS Resultado, Detalle
FROM (
    SELECT 'Products.BrandId acepta NULL' AS Chequeo,
           CASE WHEN EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'BrandId' AND is_nullable = 1) THEN 1 ELSE 0 END AS Correcto,
           '' AS Detalle
    UNION ALL
    SELECT 'Índice IX_Products_BrandId',
           CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_BrandId') THEN 1 ELSE 0 END, ''
    UNION ALL
    SELECT 'Llave foránea Products → Brands',
           CASE WHEN EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Products') AND referenced_object_id = OBJECT_ID(N'dbo.Brands')) THEN 1 ELSE 0 END, ''
    UNION ALL
    SELECT 'Columnas nuevas de Brands',
           CASE WHEN COL_LENGTH(N'dbo.Brands', N'Slug') IS NOT NULL AND COL_LENGTH(N'dbo.Brands', N'LogoUrl') IS NOT NULL
                 AND COL_LENGTH(N'dbo.Brands', N'Description') IS NOT NULL AND COL_LENGTH(N'dbo.Brands', N'IsFeatured') IS NOT NULL
                 AND COL_LENGTH(N'dbo.Brands', N'SortOrder') IS NOT NULL THEN 1 ELSE 0 END, ''
    UNION ALL
    SELECT 'Índice único IX_Brands_Slug',
           CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Brands') AND name = N'IX_Brands_Slug' AND is_unique = 1) THEN 1 ELSE 0 END, ''
    UNION ALL
    SELECT 'Migración EF registrada',
           CASE WHEN EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId = N'20261126050958_ExpandBrands') THEN 1 ELSE 0 END, ''
) checks;

-- Todas las marcas con slug válido y sin repetir (la columna se lee dinámicamente
-- para que esta consulta no falle si el 01 todavía no se ejecutó).
IF COL_LENGTH(N'dbo.Brands', N'Slug') IS NOT NULL
    EXEC(N'
SELECT ''Marcas sin slug'' AS Chequeo, CASE WHEN COUNT(*) = 0 THEN ''OK'' ELSE ''FALLA'' END AS Resultado, CAST(COUNT(*) AS varchar(10)) AS Detalle
FROM dbo.Brands WHERE Slug IS NULL OR Slug = ''''
UNION ALL
SELECT ''Slugs repetidos'', CASE WHEN COUNT(*) = 0 THEN ''OK'' ELSE ''FALLA'' END, CAST(COUNT(*) AS varchar(10))
FROM (SELECT Slug FROM dbo.Brands WHERE Slug IS NOT NULL GROUP BY Slug HAVING COUNT(*) > 1) d;

SELECT Id, Name AS Marca, Slug, IsActive AS Activa FROM dbo.Brands ORDER BY Name;');
