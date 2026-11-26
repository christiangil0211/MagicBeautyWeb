/*
  Fase B — Marcas. REVERSIÓN del 02: deja marcas y productos como estaban antes
  del 02, usando el respaldo que el 02 guardó la primera vez.

  - Vuelve a crear las marcas borradas ("Sin marca" y las duplicadas), con su Id.
  - Devuelve a cada producto la marca que tenía.
  - Las marcas creadas después del 02 se conservan; los productos creados
    después del 02 no se tocan (no están en el respaldo).
  - No borra el respaldo: hazlo a mano cuando ya no lo necesites
    (DROP TABLE dbo.BrandMigrationBackup, dbo.BrandMigrationBrandBackup).
*/
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.BrandMigrationBackup', N'U') IS NULL OR OBJECT_ID(N'dbo.BrandMigrationBrandBackup', N'U') IS NULL
BEGIN
    RAISERROR(N'No hay respaldo del 02: no hay nada que revertir.', 16, 1);
    SET NOEXEC ON;
END;
GO

BEGIN TRANSACTION;

SET IDENTITY_INSERT dbo.Brands ON;

INSERT INTO dbo.Brands (Id, Name, Slug, IsActive, CreatedAt, UpdatedAt, IsFeatured, SortOrder)
SELECT saved.Id, saved.Name, saved.Slug, saved.IsActive, saved.CreatedAt, saved.UpdatedAt, 0, 0
FROM dbo.BrandMigrationBrandBackup saved
WHERE NOT EXISTS (SELECT 1 FROM dbo.Brands b WHERE b.Id = saved.Id);

SET IDENTITY_INSERT dbo.Brands OFF;

UPDATE p SET BrandId = saved.BrandId
FROM dbo.Products p
JOIN dbo.BrandMigrationBackup saved ON saved.ProductId = p.Id
WHERE ISNULL(p.BrandId, -1) <> ISNULL(saved.BrandId, -1);

COMMIT;
GO

SET NOEXEC OFF;
GO
