/*
  Banners del inicio. Verificación del 01. Solo lee: no cambia nada.
  Todas las filas deben decir OK.
*/
SET NOCOUNT ON;

SELECT N'Tabla dbo.HomeBanners' AS Chequeo,
       CASE WHEN OBJECT_ID(N'dbo.HomeBanners', N'U') IS NOT NULL THEN N'OK' ELSE N'FALLA' END AS Resultado
UNION ALL
SELECT N'Columnas (21)',
       CASE WHEN (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.HomeBanners')) = 21
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'Columnas de vigencia StartsOn/EndsOn (date)',
       CASE WHEN (SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
                  WHERE c.object_id = OBJECT_ID(N'dbo.HomeBanners') AND c.name IN (N'StartsOn', N'EndsOn') AND t.name = N'date') = 2
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'Índice IX_HomeBanners_IsActive_SortOrder',
       CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HomeBanners') AND name = N'IX_HomeBanners_IsActive_SortOrder')
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'Migración EF registrada',
       CASE WHEN EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261127164347_AddHomeBanners')
            THEN N'OK' ELSE N'FALLA' END;

-- Recién ejecutado el 01, debe ser 0 (el 02 carga los 4 banners actuales).
SELECT COUNT(*) AS Banners FROM dbo.HomeBanners;
