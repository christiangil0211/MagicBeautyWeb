/*
  Fase B — Marcas. 02: DATOS. Se ejecuta DESPUÉS de publicar el código de marcas
  (el código anterior no soporta productos sin marca).

  Qué hace, en una sola transacción:
    1. Guarda un respaldo (dbo.BrandMigrationBackup y dbo.BrandMigrationBrandBackup)
       la primera vez que corre, para poder revertir con 02-datos-reversion.sql.
    2. Une las marcas escritas distinto ("PURPURE", "Purpure", "PÚRPURE") en la de
       más productos, mueve sus productos y borra las sobrantes (ya sin productos).
    3. Aplica SOLO las asignaciones aprobadas (#Aprobadas) a productos que siguen
       en "Sin marca".
    4. Deja sin marca (BrandId NULL) al resto de "Sin marca" y borra esa marca.
  Idempotente: si ya se aplicó, no cambia nada.

  Después: ejecuta 02-datos-verificacion.sql.
*/
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;
GO

-- ============================================================================
-- Mapeo aprobado. Se llena con el listado que apruebe la dueña (salida 3 de
-- 00-consulta-mapeo.sql, solo las filas marcadas "sí"). Mientras el mapeo no esté
-- aprobado, @MapeoAprobado = 0 y el script se detiene sin cambiar nada.
-- ============================================================================
DECLARE @MapeoAprobado bit = 0;

IF OBJECT_ID('tempdb..#Aprobadas') IS NOT NULL DROP TABLE #Aprobadas;
CREATE TABLE #Aprobadas (Reference nvarchar(20) NOT NULL PRIMARY KEY, BrandName nvarchar(150) NOT NULL);

-- INSERT INTO #Aprobadas (Reference, BrandName) VALUES
--     (N'MAN018', N'Purpure'),
--     (N'BRI071', N'Bloomshell');

IF @MapeoAprobado = 0
BEGIN
    RAISERROR(N'El mapeo todavía no está aprobado (@MapeoAprobado = 0). No se cambió nada.', 16, 1);
    SET NOEXEC ON;
END;
GO

-- ============================================================================
-- Claves de nombre (sin tildes, mayúsculas, espacios ni signos), igual que la consulta 00.
-- ============================================================================
IF OBJECT_ID('tempdb..#Keys') IS NOT NULL DROP TABLE #Keys;
SELECT b.Id, b.Name,
       REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           UPPER(CAST(b.Name COLLATE SQL_Latin1_General_CP1253_CI_AI AS varchar(200))),
           ' ', ''), '&', ''), '-', ''), '.', ''), ',', ''), '''', ''), '/', ''), '(', ''), ')', '') AS NameKey,
       (SELECT COUNT(*) FROM dbo.Products p WHERE p.BrandId = b.Id) AS Products
INTO #Keys
FROM dbo.Brands b;

-- Una asignación aprobada cuya marca no existe es un error del listado: no se cambia nada.
IF EXISTS (SELECT 1 FROM #Aprobadas a WHERE NOT EXISTS (SELECT 1 FROM #Keys k WHERE k.Name = a.BrandName))
BEGIN
    RAISERROR(N'Una marca del listado aprobado no existe. No se cambió nada.', 16, 1);
    SET NOEXEC ON;
END;
GO

BEGIN TRANSACTION;

-- 1) Respaldo (solo la primera vez).
IF OBJECT_ID(N'dbo.BrandMigrationBackup', N'U') IS NULL
BEGIN
    SELECT Id AS ProductId, BrandId, SYSUTCDATETIME() AS SavedAt
    INTO dbo.BrandMigrationBackup
    FROM dbo.Products;

    SELECT Id, Name, Slug, IsActive, CreatedAt, UpdatedAt, SYSUTCDATETIME() AS SavedAt
    INTO dbo.BrandMigrationBrandBackup
    FROM dbo.Brands;
END;

-- 2) Unificar marcas con la misma clave en la de más productos (empate: menor Id).
DECLARE @Merge TABLE (DuplicateId int PRIMARY KEY, CanonicalId int NOT NULL);

WITH Ranked AS (
    SELECT Id, NameKey, ROW_NUMBER() OVER (PARTITION BY NameKey ORDER BY Products DESC, Id) AS Position
    FROM #Keys
    WHERE NameKey <> 'SINMARCA' AND NameKey <> '')
INSERT INTO @Merge (DuplicateId, CanonicalId)
SELECT duplicate.Id, canonical.Id
FROM Ranked duplicate
JOIN Ranked canonical ON canonical.NameKey = duplicate.NameKey AND canonical.Position = 1
WHERE duplicate.Position > 1;

UPDATE p SET BrandId = m.CanonicalId, UpdatedAt = SYSUTCDATETIME()
FROM dbo.Products p
JOIN @Merge m ON m.DuplicateId = p.BrandId;

DELETE b FROM dbo.Brands b JOIN @Merge m ON m.DuplicateId = b.Id;

-- 3) Asignaciones aprobadas: solo productos que siguen en "Sin marca".
DECLARE @SinMarca TABLE (Id int PRIMARY KEY);
INSERT INTO @SinMarca SELECT Id FROM #Keys WHERE NameKey = 'SINMARCA';

UPDATE p SET BrandId = target.Id, UpdatedAt = SYSUTCDATETIME()
FROM dbo.Products p
JOIN #Aprobadas a ON a.Reference = p.Reference
JOIN #Keys k ON k.Name = a.BrandName
JOIN dbo.Brands target ON target.Id = COALESCE((SELECT CanonicalId FROM @Merge WHERE DuplicateId = k.Id), k.Id)
WHERE p.BrandId IN (SELECT Id FROM @SinMarca);

-- 4) El resto de "Sin marca" queda sin marca, y esa marca desaparece.
UPDATE dbo.Products SET BrandId = NULL, UpdatedAt = SYSUTCDATETIME()
WHERE BrandId IN (SELECT Id FROM @SinMarca);

DELETE FROM dbo.Brands WHERE Id IN (SELECT Id FROM @SinMarca);

COMMIT;
GO

SET NOEXEC OFF;
GO
