/*
  Carruseles de categorías. Verificación del 01. Solo lee: no cambia nada.
  Todas las filas deben decir OK.
*/
SET NOCOUNT ON;

SELECT N'Columna Categories.ShowAsHomeCarousel (bit, NOT NULL)' AS Chequeo,
       CASE WHEN EXISTS (
           SELECT 1 FROM sys.columns c
           JOIN sys.types t ON t.user_type_id = c.user_type_id
           WHERE c.object_id = OBJECT_ID(N'dbo.Categories') AND c.name = N'ShowAsHomeCarousel'
             AND t.name = N'bit' AND c.is_nullable = 0)
            THEN N'OK' ELSE N'FALLA' END AS Resultado
UNION ALL
SELECT N'Valor por defecto 0',
       CASE WHEN EXISTS (
           SELECT 1 FROM sys.default_constraints d
           JOIN sys.columns c ON c.object_id = d.parent_object_id AND c.column_id = d.parent_column_id
           WHERE d.parent_object_id = OBJECT_ID(N'dbo.Categories') AND c.name = N'ShowAsHomeCarousel'
             AND d.definition IN (N'((0))', N'(CONVERT([bit],(0)))'))
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'Migración EF registrada',
       CASE WHEN EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261126163734_AddCategoryHomeCarousel')
            THEN N'OK' ELSE N'FALLA' END;

-- Recién ejecutado el 01, debe ser 0 (se encienden en Admin › Categorías; máximo 5).
SELECT COUNT(*) AS CategoriasConCarrusel FROM dbo.Categories WHERE ShowAsHomeCarousel = 1;
