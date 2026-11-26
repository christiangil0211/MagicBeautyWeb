/*
  Fase B — Marcas. Verificación del 02 (solo lectura).
  Los conteos por marca deben coincidir con Admin › Marcas y con /marcas.
*/
SET NOCOUNT ON;

SELECT Chequeo, CASE WHEN Correcto = 1 THEN 'OK' ELSE 'FALLA' END AS Resultado, Detalle
FROM (
    SELECT 'No queda ninguna marca "Sin marca"' AS Chequeo,
           CASE WHEN NOT EXISTS (
               SELECT 1 FROM dbo.Brands
               WHERE REPLACE(UPPER(CAST(Name COLLATE SQL_Latin1_General_CP1253_CI_AI AS varchar(200))), ' ', '') = 'SINMARCA')
           THEN 1 ELSE 0 END AS Correcto, '' AS Detalle
    UNION ALL
    SELECT 'Ningún producto apunta a una marca inexistente',
           CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.BrandId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Brands b WHERE b.Id = p.BrandId))
           THEN 1 ELSE 0 END, ''
    UNION ALL
    SELECT 'Respaldo creado (para revertir)',
           CASE WHEN OBJECT_ID(N'dbo.BrandMigrationBackup', N'U') IS NOT NULL THEN 1 ELSE 0 END, ''
) checks;

-- Totales.
SELECT
    (SELECT COUNT(*) FROM dbo.Products) AS ProductosTotales,
    (SELECT COUNT(*) FROM dbo.Products WHERE BrandId IS NOT NULL) AS ConMarca,
    (SELECT COUNT(*) FROM dbo.Products WHERE BrandId IS NULL) AS SinMarca,
    (SELECT COUNT(*) FROM dbo.Brands) AS Marcas,
    (SELECT COUNT(*) FROM dbo.Brands WHERE LogoUrl IS NULL) AS MarcasSinLogo;

-- Conteo por marca: todos los productos y solo los completos (activos, con foto y
-- precio al detal), que son los que salen en /marcas/{slug}.
WITH ProductState AS (
    SELECT p.Id, p.BrandId,
           CASE WHEN p.IsActive = 1
                 AND EXISTS (SELECT 1 FROM dbo.ProductImages i WHERE i.ProductId = p.Id AND i.IsActive = 1)
                 AND EXISTS (SELECT 1 FROM dbo.ProductPrices pr JOIN dbo.PriceTypes t ON t.Id = pr.PriceTypeId
                             WHERE pr.ProductId = p.Id AND pr.IsActive = 1 AND pr.Amount > 0 AND t.Code = 'RETAIL')
                THEN 1 ELSE 0 END AS IsComplete
    FROM dbo.Products p)
SELECT b.Id, b.Name AS Marca, b.Slug, b.IsActive AS Activa, b.IsFeatured AS Destacada,
       CASE WHEN b.LogoUrl IS NULL THEN 'Falta' ELSE 'Sí' END AS Logo,
       COUNT(s.Id) AS Productos,
       ISNULL(SUM(s.IsComplete), 0) AS Completos
FROM dbo.Brands b
LEFT JOIN ProductState s ON s.BrandId = b.Id
GROUP BY b.Id, b.Name, b.Slug, b.IsActive, b.IsFeatured, b.LogoUrl
ORDER BY b.Name;
