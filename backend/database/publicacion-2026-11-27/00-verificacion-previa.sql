/*
  Publicación 2026-11-27. 00: VERIFICACIÓN PREVIA. Solo lee: no cambia nada.

  Ejecútala en producción ANTES de 01-migraciones.sql. Todas las filas de la
  primera tabla deben decir OK. Si alguna dice FALLA, no sigas: envíame el
  resultado.
*/
SET NOCOUNT ON;

SELECT N'1. Producción tiene la última migración anterior (AddSaleInvoiceAmounts)' AS Chequeo,
       CASE WHEN EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId = N'20261126190617_AddSaleInvoiceAmounts')
            THEN N'OK' ELSE N'FALLA' END AS Resultado
UNION ALL
SELECT N'2. Ninguna de las 5 migraciones nuevas está aplicada (si dice YA APLICADAS, no hay nada que hacer)',
       CASE (SELECT COUNT(*) FROM dbo.__EFMigrationsHistory WHERE MigrationId IN (
                N'20261127160355_AddUserSecurityStamp', N'20261127161033_AddCommercialCustomerModel',
                N'20261127162109_TrackCustomerImportsAndInvoiceIdentity', N'20261127164347_AddHomeBanners',
                N'20261127170144_TrackCommercialRepurchaseNotices'))
            WHEN 0 THEN N'OK' WHEN 5 THEN N'YA APLICADAS' ELSE N'FALLA (aplicadas a medias)' END
UNION ALL
SELECT N'3. Roles base: 1 ADMIN, 2 CUSTOMER_RETAIL, 3 CUSTOMER_WHOLESALE',
       CASE WHEN EXISTS (SELECT 1 FROM dbo.Roles WHERE Id = 1 AND Code = N'ADMIN')
             AND EXISTS (SELECT 1 FROM dbo.Roles WHERE Id = 2 AND Code = N'CUSTOMER_RETAIL')
             AND EXISTS (SELECT 1 FROM dbo.Roles WHERE Id = 3 AND Code = N'CUSTOMER_WHOLESALE')
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'4. No existe todavía el rol 4 / CUSTOMER_DISTRIBUTOR (lo crea la migración)',
       CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Id = 4 OR Code = N'CUSTOMER_DISTRIBUTOR')
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'5. Ningún usuario tiene más de un rol comercial',
       CASE WHEN NOT EXISTS (
                SELECT ur.UserId FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.Id = ur.RoleId
                WHERE r.Code LIKE N'CUSTOMER[_]%' GROUP BY ur.UserId HAVING COUNT(*) > 1)
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'6. Existe el tipo de precio 3 (el nuevo rol distribuidor lo usa)',
       CASE WHEN EXISTS (SELECT 1 FROM dbo.PriceTypes WHERE Id = 3) THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'7. Existen la llave e índices que la migración reemplaza',
       CASE WHEN OBJECT_ID(N'dbo.FK_UserRoles_Roles_RoleId', N'F') IS NOT NULL
             AND EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.UserRoles') AND name = N'IX_UserRoles_RoleId')
             AND EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.EmailVerificationCodes') AND name = N'IX_EmailVerificationCodes_UserId_ConsumedAt')
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'8. No existen todavía las tablas nuevas',
       CASE WHEN OBJECT_ID(N'dbo.HomeBanners') IS NULL AND OBJECT_ID(N'dbo.Customers') IS NULL
             AND OBJECT_ID(N'dbo.RoleRequests') IS NULL AND OBJECT_ID(N'dbo.PrivacyConsents') IS NULL
             AND OBJECT_ID(N'dbo.CommercialRoleHistory') IS NULL AND OBJECT_ID(N'dbo.CommercialNotices') IS NULL
            THEN N'OK' ELSE N'FALLA' END;

-- Informativo: qué datos cambian de lugar (no se pierden).
-- Estos clientes pasan su rol de UserRoles a Users.CommercialRoleId.
-- Entre el script y el fin del despliegue (unos minutos) podrían ver precios al detal.
SELECT r.Code AS RolComercial, COUNT(*) AS Usuarios
FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.Id = ur.RoleId
WHERE r.Code LIKE N'CUSTOMER[_]%'
GROUP BY r.Code;

SELECT (SELECT COUNT(*) FROM dbo.Users) AS UsuariosTotales,
       (SELECT COUNT(*) FROM dbo.UserRoles) AS VinculosUserRoles,
       (SELECT COUNT(*) FROM dbo.Roles) AS Roles,
       (SELECT COUNT(*) FROM dbo.RolePriceTypes) AS RolPrecio;

-- Últimas migraciones registradas.
SELECT TOP (5) MigrationId FROM dbo.__EFMigrationsHistory ORDER BY MigrationId DESC;
