/*
  Banners del inicio. 01: ESQUEMA. Se ejecuta ANTES de publicar el código.

  - Solo crea la tabla nueva dbo.HomeBanners (vacía) y su índice. No toca
    ninguna tabla existente: el código que hoy está en producción sigue
    funcionando después de ejecutarlo.
  - Idempotente: revisa el esquema real antes de cada paso. Se puede ejecutar
    varias veces.
  - Registra la migración EF 20261127164347_AddHomeBanners para que el
    historial del código y la base coincidan.

  Después: ejecuta 01-esquema-verificacion.sql. Si todo sale OK, se puede publicar.
  Luego, 02-datos.sql carga los 4 banners que hoy están fijos en el código.
*/
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

-- 1) Tabla de banners.
IF OBJECT_ID(N'dbo.HomeBanners', N'U') IS NULL
    CREATE TABLE [dbo].[HomeBanners] (
        [Id] int NOT NULL IDENTITY(1, 1),
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

-- 2) Índice para la consulta de la tienda (activos en orden).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.HomeBanners') AND name = N'IX_HomeBanners_IsActive_SortOrder')
    CREATE INDEX [IX_HomeBanners_IsActive_SortOrder] ON [dbo].[HomeBanners] ([IsActive], [SortOrder]);

-- 3) Historial de migraciones de EF.
IF NOT EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261127164347_AddHomeBanners')
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261127164347_AddHomeBanners', N'10.0.8');

COMMIT;
GO
