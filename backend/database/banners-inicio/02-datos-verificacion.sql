/*
  Banners del inicio. Verificación del 02. Solo lee: no cambia nada.
*/
SET NOCOUNT ON;

SELECT N'Hay banners cargados' AS Chequeo,
       CASE WHEN EXISTS (SELECT 1 FROM dbo.HomeBanners) THEN N'OK' ELSE N'FALLA' END AS Resultado
UNION ALL
SELECT N'Los activos tienen imagen',
       CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.HomeBanners WHERE IsActive = 1 AND ImageUrl IS NULL) THEN N'OK' ELSE N'REVISAR' END
UNION ALL
SELECT N'Zonas y botones en JSON válido',
       CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.HomeBanners
                             WHERE (HotspotsJson IS NOT NULL AND ISJSON(HotspotsJson) = 0)
                                OR (MobileCtasJson IS NOT NULL AND ISJSON(MobileCtasJson) = 0))
            THEN N'OK' ELSE N'FALLA' END;

-- Orden del carrusel tal como lo verá la tienda hoy (fecha de Colombia).
DECLARE @hoy date = CAST(DATEADD(HOUR, -5, SYSUTCDATETIME()) AS date);

SELECT SortOrder, Id, Name, IsActive, StartsOn, EndsOn,
       CASE WHEN IsActive = 1 AND ImageUrl IS NOT NULL
                 AND (StartsOn IS NULL OR StartsOn <= @hoy) AND (EndsOn IS NULL OR EndsOn >= @hoy)
            THEN N'sí' ELSE N'no' END AS SeVeHoy,
       ImageUrl
FROM dbo.HomeBanners
ORDER BY SortOrder, Id;
