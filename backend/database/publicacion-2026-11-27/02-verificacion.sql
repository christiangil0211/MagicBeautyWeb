/*
  Publicación 2026-11-27. 02: VERIFICACIÓN. Solo lee: no cambia nada.
  Ejecútala después de 01-migraciones.sql. Todas las filas deben decir OK.
  Compara los conteos con los de 00-verificacion-previa.sql.
*/
SET NOCOUNT ON;

SELECT N'Las 5 migraciones están registradas' AS Chequeo,
       CASE WHEN (SELECT COUNT(*) FROM dbo.__EFMigrationsHistory WHERE MigrationId IN (
                N'20261127160355_AddUserSecurityStamp', N'20261127161033_AddCommercialCustomerModel',
                N'20261127162109_TrackCustomerImportsAndInvoiceIdentity', N'20261127164347_AddHomeBanners',
                N'20261127170144_TrackCommercialRepurchaseNotices')) = 5
            THEN N'OK' ELSE N'FALLA' END AS Resultado
UNION ALL
SELECT N'Tablas nuevas creadas',
       CASE WHEN OBJECT_ID(N'dbo.HomeBanners') IS NOT NULL AND OBJECT_ID(N'dbo.Customers') IS NOT NULL
             AND OBJECT_ID(N'dbo.RoleRequests') IS NOT NULL AND OBJECT_ID(N'dbo.PrivacyConsents') IS NOT NULL
             AND OBJECT_ID(N'dbo.CommercialRoleHistory') IS NOT NULL AND OBJECT_ID(N'dbo.CommercialNotices') IS NOT NULL
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'Rol distribuidor creado con su tipo de precio',
       CASE WHEN EXISTS (SELECT 1 FROM dbo.Roles WHERE Id = 4 AND Code = N'CUSTOMER_DISTRIBUTOR')
             AND EXISTS (SELECT 1 FROM dbo.RolePriceTypes WHERE RoleId = 4 AND PriceTypeId = 3)
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'UserRoles solo conserva roles internos (administración)',
       CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.UserRoles ur JOIN dbo.Roles r ON r.Id = ur.RoleId WHERE r.Kind = 1)
            THEN N'OK' ELSE N'FALLA' END
UNION ALL
SELECT N'Todos los usuarios tienen sello de seguridad',
       CASE WHEN NOT EXISTS (SELECT 1 FROM dbo.Users WHERE SecurityStamp IS NULL) THEN N'OK' ELSE N'FALLA' END;

-- Clientes con rol comercial, ahora en Users.CommercialRoleId (deben sumar lo mismo que antes).
SELECT r.Code AS RolComercial, COUNT(*) AS Usuarios
FROM dbo.Users u JOIN dbo.Roles r ON r.Id = u.CommercialRoleId
GROUP BY r.Code;

SELECT (SELECT COUNT(*) FROM dbo.Users) AS UsuariosTotales,
       (SELECT COUNT(*) FROM dbo.UserRoles) AS VinculosUserRoles_SoloInternos,
       (SELECT COUNT(*) FROM dbo.Roles) AS Roles,
       (SELECT COUNT(*) FROM dbo.HomeBanners) AS Banners;
