/*
  Fase B — Marcas. Consulta de SOLO LECTURA para proponer el mapeo.
  No modifica nada: solo SELECT. Ejecútala completa en Azure SQL (MagicProcess)
  y exporta los 5 resultados (CSV o captura).

  Reglas:
  - Clave de una marca = nombre sin tildes, en mayúsculas, sin espacios ni signos.
    Las marcas con la misma clave se unifican en la que tiene más productos.
  - "Sin marca" = la marca cuya clave es SINMARCA.
  - Un producto en "Sin marca" se propone para una marca si el nombre del producto
    contiene el nombre de la marca como PALABRA COMPLETA (sin tildes ni mayúsculas).
    Si coincide con dos o más marcas distintas, es AMBIGUO y no se asigna.
*/
SET NOCOUNT ON;

DECLARE @Brands TABLE (
    Id int PRIMARY KEY,
    Name nvarchar(200),
    IsActive bit,
    NameKey varchar(200),   -- para unificar: PURPURE, KEVINCOCO
    NameWords varchar(300), -- para buscar palabras: " PURPURE ", " KEVIN COCO "
    Products int,
    ActiveProducts int);

INSERT INTO @Brands (Id, Name, IsActive, NameKey, NameWords, Products, ActiveProducts)
SELECT b.Id, b.Name, b.IsActive, k.NameKey, w.NameWords,
       (SELECT COUNT(*) FROM dbo.Products p WHERE p.BrandId = b.Id),
       (SELECT COUNT(*) FROM dbo.Products p WHERE p.BrandId = b.Id AND p.IsActive = 1)
FROM dbo.Brands b
-- Sin tildes y en mayúsculas (la intercalación 1253 quita los acentos al pasar a varchar).
CROSS APPLY (SELECT UPPER(CAST(b.Name COLLATE SQL_Latin1_General_CP1253_CI_AI AS varchar(200))) AS Plain) a
-- Signos a espacios.
CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(a.Plain,
            '&', ' '), '-', ' '), '.', ' '), ',', ' '), '''', ' '), '/', ' '), '(', ' '), ')', ' ') AS Spaced) s
CROSS APPLY (SELECT REPLACE(s.Spaced, ' ', '') AS NameKey) k
-- Espacios repetidos a uno solo, con un espacio a cada lado.
CROSS APPLY (SELECT ' ' + LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(s.Spaced, '  ', ' '), '  ', ' '), '  ', ' '))) + ' ' AS NameWords) w;

DECLARE @SinMarcaKey varchar(20) = 'SINMARCA';

-- Marca que queda de cada grupo: la de más productos (empate: la de menor Id).
DECLARE @Canonical TABLE (NameKey varchar(200) PRIMARY KEY, CanonicalId int, CanonicalName nvarchar(200), NameWords varchar(300));
INSERT INTO @Canonical
SELECT NameKey, Id, Name, NameWords
FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY NameKey ORDER BY Products DESC, Id) AS RowNumber FROM @Brands) ranked
WHERE RowNumber = 1 AND NameKey <> @SinMarcaKey AND NameKey <> '';

-- Productos hoy en "Sin marca", con su nombre preparado igual que el de las marcas.
DECLARE @Unbranded TABLE (ProductId int PRIMARY KEY, Reference nvarchar(20), Name nvarchar(300), IsActive bit, NameWords varchar(400));
INSERT INTO @Unbranded
SELECT p.Id, p.Reference, p.Name, p.IsActive,
       ' ' + LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(s.Spaced, '  ', ' '), '  ', ' '), '  ', ' '))) + ' '
FROM dbo.Products p
JOIN @Brands b ON b.Id = p.BrandId AND b.NameKey = @SinMarcaKey
CROSS APPLY (SELECT UPPER(CAST(p.Name COLLATE SQL_Latin1_General_CP1253_CI_AI AS varchar(300))) AS Plain) a
CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(a.Plain,
            '&', ' '), '-', ' '), '.', ' '), ',', ' '), '''', ' '), '/', ' '), '(', ' '), ')', ' ') AS Spaced) s;

DECLARE @Matches TABLE (ProductId int, CanonicalId int, CanonicalName nvarchar(200), MatchedWords varchar(300));
INSERT INTO @Matches
SELECT u.ProductId, c.CanonicalId, c.CanonicalName, LTRIM(RTRIM(c.NameWords))
FROM @Unbranded u
JOIN @Canonical c ON u.NameWords LIKE '%' + c.NameWords + '%';

-- (1) Marcas actuales con su conteo de productos.
SELECT b.Id, b.Name AS Marca, b.IsActive AS Activa, b.Products AS Productos, b.ActiveProducts AS ProductosActivos,
       b.NameKey AS Clave,
       CASE WHEN b.NameKey = @SinMarcaKey THEN 'Pasa a NULL (sin marca)'
            WHEN c.CanonicalId = b.Id THEN 'Se conserva'
            ELSE 'Se une a ' + c.CanonicalName + ' (Id ' + CAST(c.CanonicalId AS varchar(10)) + ')' END AS Accion
FROM @Brands b
LEFT JOIN @Canonical c ON c.NameKey = b.NameKey
ORDER BY b.Name;

-- (2) Grupos de nombres que se unificarían (misma clave, varias marcas).
SELECT b.NameKey AS Clave, c.CanonicalId AS QuedaId, c.CanonicalName AS QuedaComo,
       b.Id AS MarcaId, b.Name AS Marca, b.Products AS Productos
FROM @Brands b
JOIN @Canonical c ON c.NameKey = b.NameKey
WHERE b.NameKey IN (SELECT NameKey FROM @Brands GROUP BY NameKey HAVING COUNT(*) > 1)
ORDER BY b.NameKey, b.Products DESC, b.Id;

-- (3) Asignaciones propuestas: productos en "Sin marca" que coinciden con UNA sola marca.
SELECT u.Reference AS Referencia, u.Name AS Producto, u.IsActive AS Activo,
       m.CanonicalId AS MarcaPropuestaId, m.CanonicalName AS MarcaPropuesta,
       'El nombre contiene "' + m.MatchedWords + '" como palabra completa' AS Regla,
       CASE WHEN u.NameWords LIKE '% COMBO %' OR u.NameWords LIKE '% KIT %' OR u.NameWords LIKE '% Y %'
            THEN 'Revisar: combo, kit o mezcla' ELSE '' END AS Aviso
FROM @Unbranded u
JOIN @Matches m ON m.ProductId = u.ProductId
WHERE u.ProductId IN (SELECT ProductId FROM @Matches GROUP BY ProductId HAVING COUNT(DISTINCT CanonicalId) = 1)
ORDER BY m.CanonicalName, u.Reference;

-- (4) Ambiguos: coinciden con dos o más marcas distintas. No se asignan.
SELECT u.Reference AS Referencia, u.Name AS Producto, u.IsActive AS Activo,
       STRING_AGG(m.CanonicalName, ' | ') WITHIN GROUP (ORDER BY m.CanonicalName) AS MarcasQueCoinciden
FROM @Unbranded u
JOIN @Matches m ON m.ProductId = u.ProductId
GROUP BY u.ProductId, u.Reference, u.Name, u.IsActive
HAVING COUNT(DISTINCT m.CanonicalId) > 1
ORDER BY u.Reference;

-- (5) Totales.
SELECT
    (SELECT COUNT(*) FROM dbo.Products) AS ProductosTotales,
    (SELECT COUNT(*) FROM @Unbranded) AS EnSinMarcaHoy,
    (SELECT COUNT(*) FROM (SELECT ProductId FROM @Matches GROUP BY ProductId HAVING COUNT(DISTINCT CanonicalId) = 1) x) AS AsignacionesPropuestas,
    (SELECT COUNT(*) FROM (SELECT ProductId FROM @Matches GROUP BY ProductId HAVING COUNT(DISTINCT CanonicalId) > 1) x) AS Ambiguos,
    (SELECT COUNT(*) FROM @Unbranded)
      - (SELECT COUNT(*) FROM (SELECT ProductId FROM @Matches GROUP BY ProductId HAVING COUNT(DISTINCT CanonicalId) = 1) x) AS QuedariaSinMarca,
    (SELECT COUNT(*) FROM @Brands WHERE NameKey <> @SinMarcaKey AND NameKey IN (SELECT NameKey FROM @Brands GROUP BY NameKey HAVING COUNT(*) > 1)) AS MarcasEnGruposAUnificar,
    (SELECT COUNT(*) FROM @Canonical) AS MarcasFinales;
