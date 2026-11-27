/*
  Publicación 2026-11-27. 01: MIGRACIONES. Se ejecuta ANTES de publicar el código.

  Aplica las 5 migraciones pendientes en producción (todas posteriores a
  20261126190617_AddSaleInvoiceAmounts):
    1. 20261127160355_AddUserSecurityStamp             (usuarios: columna nueva)
    2. 20261127161033_AddCommercialCustomerModel       (usuarios: clientes y roles comerciales)
    3. 20261127162109_TrackCustomerImportsAndInvoiceIdentity (ventas: columnas nuevas)
    4. 20261127164347_AddHomeBanners                   (banners: tabla nueva)
    5. 20261127170144_TrackCommercialRepurchaseNotices (usuarios: tabla nueva)

  TODO O NADA: una sola transacción. Ante cualquier error se deshace todo y
  el resto del script no se ejecuta (SET NOEXEC). No borra datos: la
  migración 2 mueve el rol comercial de cada cliente de UserRoles a
  Users.CommercialRoleId, y se aborta sola si los roles no son los esperados.

  Idempotente: cada paso revisa __EFMigrationsHistory; si ya se aplicó, no
  hace nada. Antes: 00-verificacion-previa.sql. Después: 02-verificacion.sql.

  Generado con: dotnet ef migrations script 20261126190617_AddSaleInvoiceAmounts --idempotent
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET NOEXEC OFF;
GO

BEGIN TRANSACTION;
GO

-- Guardián: si algo falló antes, la transacción ya no existe; no se ejecuta nada más.
IF @@TRANCOUNT = 0
BEGIN
    RAISERROR(N'*** SE DETUVO: hubo un error y NO se aplicó ningún cambio. Revisa el mensaje anterior. ***', 16, 1);
    SET NOEXEC ON;
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127160355_AddUserSecurityStamp'
)
BEGIN
    ALTER TABLE [Users] ADD [SecurityStamp] uniqueidentifier NOT NULL DEFAULT (NEWID());
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127160355_AddUserSecurityStamp'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261127160355_AddUserSecurityStamp', N'10.0.8');
END;

COMMIT;
GO

-- Guardián: si algo falló antes, la transacción ya no existe; no se ejecuta nada más.
IF @@TRANCOUNT = 0
BEGIN
    RAISERROR(N'*** SE DETUVO: hubo un error y NO se aplicó ningún cambio. Revisa el mensaje anterior. ***', 16, 1);
    SET NOEXEC ON;
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [UserRoles] DROP CONSTRAINT [FK_UserRoles_Roles_RoleId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    DROP INDEX [IX_UserRoles_RoleId] ON [UserRoles];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    DROP INDEX [IX_EmailVerificationCodes_UserId_ConsumedAt] ON [EmailVerificationCodes];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD [City] nvarchar(120) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD [CommercialRoleId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD [CommercialRoleKind] int NOT NULL DEFAULT 1;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD [CustomerId] bigint NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD [DocumentNumber] nvarchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD [FullName] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD [Phone] nvarchar(32) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD [RowVersion] rowversion NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [UserRoles] ADD [InternalRoleKind] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [sales].[Sales] ADD [CustomerId] bigint NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Roles] ADD [IsSelfRequestable] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Roles] ADD [Kind] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Roles] ADD [RepurchaseDays] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [EmailVerificationCodes] ADD [Purpose] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Roles] ADD CONSTRAINT [AK_Roles_Id_Kind] UNIQUE ([Id], [Kind]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE TABLE [CommercialRoleHistory] (
        [Id] bigint NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [PreviousRoleId] int NULL,
        [NewRoleId] int NOT NULL,
        [Reason] int NOT NULL,
        [ActorUserId] int NULL,
        [ChangedAt] datetimeoffset NOT NULL,
        CONSTRAINT [PK_CommercialRoleHistory] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CommercialRoleHistory_Roles_NewRoleId] FOREIGN KEY ([NewRoleId]) REFERENCES [Roles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CommercialRoleHistory_Roles_PreviousRoleId] FOREIGN KEY ([PreviousRoleId]) REFERENCES [Roles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CommercialRoleHistory_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CommercialRoleHistory_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE TABLE [Customers] (
        [Id] bigint NOT NULL IDENTITY,
        [Source] nvarchar(64) NOT NULL,
        [ExternalId] nvarchar(128) NOT NULL,
        [DocumentNumber] nvarchar(40) NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [Email] nvarchar(254) NULL,
        [Phone] nvarchar(32) NULL,
        [City] nvarchar(120) NULL,
        [BillingAddress] nvarchar(300) NULL,
        CONSTRAINT [PK_Customers] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE TABLE [PrivacyConsents] (
        [Id] bigint NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [PolicyVersion] nvarchar(24) NOT NULL,
        [AcceptedAt] datetimeoffset NOT NULL,
        [Accepted] bit NOT NULL,
        [MarketingOptIn] bit NOT NULL,
        [IpAddress] nvarchar(45) NULL,
        CONSTRAINT [PK_PrivacyConsents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_PrivacyConsents_Accepted] CHECK ([Accepted] = 1),
        CONSTRAINT [FK_PrivacyConsents_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE TABLE [RoleRequests] (
        [Id] bigint NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [RequestedRoleId] int NOT NULL,
        [CommercialRoleKind] int NOT NULL DEFAULT 1,
        [DocumentNumber] nvarchar(40) NOT NULL,
        [Status] int NOT NULL,
        [Note] nvarchar(1000) NULL,
        [ReviewedByUserId] int NULL,
        [CreatedAt] datetimeoffset NOT NULL,
        [ReviewedAt] datetimeoffset NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT [PK_RoleRequests] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_RoleRequests_CommercialRoleKind] CHECK ([CommercialRoleKind] = 1),
        CONSTRAINT [FK_RoleRequests_Roles_RequestedRoleId_CommercialRoleKind] FOREIGN KEY ([RequestedRoleId], [CommercialRoleKind]) REFERENCES [Roles] ([Id], [Kind]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RoleRequests_Users_ReviewedByUserId] FOREIGN KEY ([ReviewedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RoleRequests_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    EXEC(N'
        IF NOT EXISTS (SELECT 1 FROM [Roles] WHERE [Id] = 1 AND [Code] = ''ADMIN'')
           OR NOT EXISTS (SELECT 1 FROM [Roles] WHERE [Id] = 2 AND [Code] = ''CUSTOMER_RETAIL'')
           OR NOT EXISTS (SELECT 1 FROM [Roles] WHERE [Id] = 3 AND [Code] = ''CUSTOMER_WHOLESALE'')
           OR EXISTS (SELECT 1 FROM [Roles] WHERE [Id] = 4 OR [Code] = ''CUSTOMER_DISTRIBUTOR'')
            THROW 51000, ''Las filas base de Roles difieren de la semilla esperada. Revisar IDs y códigos antes de migrar.'', 1;

        UPDATE [Roles] SET [Kind] = 1 WHERE [Code] LIKE ''CUSTOMER[_]%'';
        UPDATE [Roles] SET [IsSelfRequestable] = 1, [RepurchaseDays] = 30 WHERE [Id] = 3;

        DECLARE @conflicts nvarchar(2048);
        SELECT @conflicts = STRING_AGG(CONVERT(nvarchar(20), [UserId]), '','')
        FROM (
            SELECT TOP (10) links.[UserId]
            FROM [UserRoles] links
            JOIN [Roles] roles ON roles.[Id] = links.[RoleId]
            WHERE roles.[Kind] = 1
            GROUP BY links.[UserId]
            HAVING COUNT(*) > 1
            ORDER BY links.[UserId]
        ) conflicts;
        IF @conflicts IS NOT NULL
        BEGIN
            DECLARE @message nvarchar(2048) = CONCAT(
                ''Hay usuarios con varios roles comerciales. Primeros IDs afectados: '', @conflicts);
            THROW 51001, @message, 1;
        END;

        UPDATE users SET [CommercialRoleId] = links.[RoleId]
        FROM [Users] users
        JOIN [UserRoles] links ON links.[UserId] = users.[Id]
        JOIN [Roles] roles ON roles.[Id] = links.[RoleId] AND roles.[Kind] = 1;

        DELETE links FROM [UserRoles] links
        JOIN [Roles] roles ON roles.[Id] = links.[RoleId] AND roles.[Kind] = 1;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Code', N'IsActive', N'IsSelfRequestable', N'Kind', N'Name', N'RepurchaseDays') AND [object_id] = OBJECT_ID(N'[Roles]'))
        SET IDENTITY_INSERT [Roles] ON;
    EXEC(N'INSERT INTO [Roles] ([Id], [Code], [IsActive], [IsSelfRequestable], [Kind], [Name], [RepurchaseDays])
    VALUES (4, N''CUSTOMER_DISTRIBUTOR'', CAST(1 AS bit), CAST(1 AS bit), 1, N''Cliente distribuidor'', NULL)');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'Code', N'IsActive', N'IsSelfRequestable', N'Kind', N'Name', N'RepurchaseDays') AND [object_id] = OBJECT_ID(N'[Roles]'))
        SET IDENTITY_INSERT [Roles] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'PriceTypeId', N'RoleId') AND [object_id] = OBJECT_ID(N'[RolePriceTypes]'))
        SET IDENTITY_INSERT [RolePriceTypes] ON;
    EXEC(N'INSERT INTO [RolePriceTypes] ([PriceTypeId], [RoleId])
    VALUES (3, 4)');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'PriceTypeId', N'RoleId') AND [object_id] = OBJECT_ID(N'[RolePriceTypes]'))
        SET IDENTITY_INSERT [RolePriceTypes] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_Users_CommercialRoleId_CommercialRoleKind] ON [Users] ([CommercialRoleId], [CommercialRoleKind]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_Users_CustomerId] ON [Users] ([CustomerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    EXEC(N'ALTER TABLE [Users] ADD CONSTRAINT [CK_Users_CommercialRoleKind] CHECK ([CommercialRoleKind] = 1)');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_UserRoles_RoleId_InternalRoleKind] ON [UserRoles] ([RoleId], [InternalRoleKind]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    EXEC(N'ALTER TABLE [UserRoles] ADD CONSTRAINT [CK_UserRoles_InternalRoleKind] CHECK ([InternalRoleKind] = 0)');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_Sales_CustomerId_SaleDate] ON [sales].[Sales] ([CustomerId], [SaleDate]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    EXEC(N'ALTER TABLE [Roles] ADD CONSTRAINT [CK_Roles_CommercialSettings] CHECK (([RepurchaseDays] IS NULL OR [RepurchaseDays] > 0) AND ([Kind] = 1 OR ([IsSelfRequestable] = 0 AND [RepurchaseDays] IS NULL)))');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    EXEC(N'ALTER TABLE [Roles] ADD CONSTRAINT [CK_Roles_Kind] CHECK ([Kind] IN (0, 1))');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_EmailVerificationCodes_UserId_Purpose_ConsumedAt] ON [EmailVerificationCodes] ([UserId], [Purpose], [ConsumedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_CommercialRoleHistory_ActorUserId] ON [CommercialRoleHistory] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_CommercialRoleHistory_NewRoleId] ON [CommercialRoleHistory] ([NewRoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_CommercialRoleHistory_PreviousRoleId] ON [CommercialRoleHistory] ([PreviousRoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_CommercialRoleHistory_UserId_ChangedAt] ON [CommercialRoleHistory] ([UserId], [ChangedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_Customers_DocumentNumber] ON [Customers] ([DocumentNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Customers_Source_DocumentNumber] ON [Customers] ([Source], [DocumentNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Customers_Source_ExternalId] ON [Customers] ([Source], [ExternalId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_PrivacyConsents_UserId_AcceptedAt] ON [PrivacyConsents] ([UserId], [AcceptedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_RoleRequests_RequestedRoleId_CommercialRoleKind] ON [RoleRequests] ([RequestedRoleId], [CommercialRoleKind]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_RoleRequests_ReviewedByUserId] ON [RoleRequests] ([ReviewedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    CREATE INDEX [IX_RoleRequests_Status_CreatedAt] ON [RoleRequests] ([Status], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_RoleRequests_UserId] ON [RoleRequests] ([UserId]) WHERE [Status] = 0');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [sales].[Sales] ADD CONSTRAINT [FK_Sales_Customers_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [Customers] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [UserRoles] ADD CONSTRAINT [FK_UserRoles_Roles_RoleId_InternalRoleKind] FOREIGN KEY ([RoleId], [InternalRoleKind]) REFERENCES [Roles] ([Id], [Kind]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD CONSTRAINT [FK_Users_Customers_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [Customers] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    ALTER TABLE [Users] ADD CONSTRAINT [FK_Users_Roles_CommercialRoleId_CommercialRoleKind] FOREIGN KEY ([CommercialRoleId], [CommercialRoleKind]) REFERENCES [Roles] ([Id], [Kind]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127161033_AddCommercialCustomerModel'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261127161033_AddCommercialCustomerModel', N'10.0.8');
END;

COMMIT;
GO

-- Guardián: si algo falló antes, la transacción ya no existe; no se ejecuta nada más.
IF @@TRANCOUNT = 0
BEGIN
    RAISERROR(N'*** SE DETUVO: hubo un error y NO se aplicó ningún cambio. Revisa el mensaje anterior. ***', 16, 1);
    SET NOEXEC ON;
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127162109_TrackCustomerImportsAndInvoiceIdentity'
)
BEGIN
    ALTER TABLE [sales].[Sales] ADD [CustomerDocumentNumber] nvarchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127162109_TrackCustomerImportsAndInvoiceIdentity'
)
BEGIN
    ALTER TABLE [sales].[Sales] ADD [CustomerExternalId] nvarchar(128) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127162109_TrackCustomerImportsAndInvoiceIdentity'
)
BEGIN
    ALTER TABLE [sales].[ImportRuns] ADD [Contacts] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127162109_TrackCustomerImportsAndInvoiceIdentity'
)
BEGIN
    ALTER TABLE [sales].[ImportRuns] ADD [Kind] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127162109_TrackCustomerImportsAndInvoiceIdentity'
)
BEGIN
    ALTER TABLE [sales].[ImportRuns] ADD [SkippedContacts] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127162109_TrackCustomerImportsAndInvoiceIdentity'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261127162109_TrackCustomerImportsAndInvoiceIdentity', N'10.0.8');
END;

COMMIT;
GO

-- Guardián: si algo falló antes, la transacción ya no existe; no se ejecuta nada más.
IF @@TRANCOUNT = 0
BEGIN
    RAISERROR(N'*** SE DETUVO: hubo un error y NO se aplicó ningún cambio. Revisa el mensaje anterior. ***', 16, 1);
    SET NOEXEC ON;
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127164347_AddHomeBanners'
)
BEGIN
    CREATE TABLE [HomeBanners] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(60) NOT NULL,
        [Title] nvarchar(150) NOT NULL,
        [AltText] nvarchar(500) NOT NULL,
        [ImageUrl] nvarchar(500) NULL,
        [ImageWidth] int NOT NULL,
        [ImageHeight] int NOT NULL,
        [ImageUrl768] nvarchar(500) NULL,
        [ImageUrl1280] nvarchar(500) NULL,
        [LinkUrl] nvarchar(300) NULL,
        [LinkLabel] nvarchar(80) NULL,
        [HotspotsJson] nvarchar(2000) NULL,
        [MobileCtasJson] nvarchar(1000) NULL,
        [NoteHighlight] nvarchar(60) NULL,
        [NoteText] nvarchar(200) NULL,
        [StartsOn] date NULL,
        [EndsOn] date NULL,
        [SortOrder] int NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_HomeBanners] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127164347_AddHomeBanners'
)
BEGIN
    CREATE INDEX [IX_HomeBanners_IsActive_SortOrder] ON [HomeBanners] ([IsActive], [SortOrder]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127164347_AddHomeBanners'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261127164347_AddHomeBanners', N'10.0.8');
END;

COMMIT;
GO

-- Guardián: si algo falló antes, la transacción ya no existe; no se ejecuta nada más.
IF @@TRANCOUNT = 0
BEGIN
    RAISERROR(N'*** SE DETUVO: hubo un error y NO se aplicó ningún cambio. Revisa el mensaje anterior. ***', 16, 1);
    SET NOEXEC ON;
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127170144_TrackCommercialRepurchaseNotices'
)
BEGIN
    ALTER TABLE [sales].[ImportRuns] ADD [CapturesCustomerEvidence] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127170144_TrackCommercialRepurchaseNotices'
)
BEGIN
    CREATE TABLE [CommercialNotices] (
        [Id] bigint NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [RoleId] int NOT NULL,
        [Source] nvarchar(64) NOT NULL,
        [AssignmentId] bigint NOT NULL,
        [PurchaseOn] date NOT NULL,
        [DueOn] date NOT NULL,
        [Kind] int NOT NULL,
        [AttemptedAt] datetimeoffset NULL,
        [SentAt] datetimeoffset NULL,
        CONSTRAINT [PK_CommercialNotices] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CommercialNotices_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [Roles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CommercialNotices_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127170144_TrackCommercialRepurchaseNotices'
)
BEGIN
    CREATE INDEX [IX_CommercialNotices_RoleId] ON [CommercialNotices] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127170144_TrackCommercialRepurchaseNotices'
)
BEGIN
    CREATE INDEX [IX_CommercialNotices_Source_AttemptedAt_Id] ON [CommercialNotices] ([Source], [AttemptedAt], [Id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127170144_TrackCommercialRepurchaseNotices'
)
BEGIN
    CREATE UNIQUE INDEX [IX_CommercialNotices_UserId_RoleId_AssignmentId_PurchaseOn_Kind] ON [CommercialNotices] ([UserId], [RoleId], [AssignmentId], [PurchaseOn], [Kind]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261127170144_TrackCommercialRepurchaseNotices'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261127170144_TrackCommercialRepurchaseNotices', N'10.0.8');
END;

COMMIT;
GO

-- Guardián: si algo falló antes, la transacción ya no existe; no se ejecuta nada más.
IF @@TRANCOUNT = 0
BEGIN
    RAISERROR(N'*** SE DETUVO: hubo un error y NO se aplicó ningún cambio. Revisa el mensaje anterior. ***', 16, 1);
    SET NOEXEC ON;
END;
GO

COMMIT;
PRINT N'OK: las 5 migraciones quedaron aplicadas.';
GO

SET NOEXEC OFF;
GO
