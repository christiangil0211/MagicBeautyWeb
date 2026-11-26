/*
  Ventas (importación desde Alegra y "Más vendidos"). 01: ESQUEMA. Se ejecuta
  ANTES de publicar el código.

  - Crea el esquema [sales] con 4 tablas nuevas y vacías: ImportRuns, Sales,
    SaleLines y SourceItemMappings. No toca ni borra nada de las tablas
    existentes (solo agrega llaves foráneas hacia dbo.Products). El código que
    hoy está en producción sigue funcionando después de ejecutarlo.
  - Equivale a las migraciones EF:
      20261126174219_AddSalesImport
      20261126185653_AddSaleInvoiceDetails
      20261126190617_AddSaleInvoiceAmounts
    y las registra en __EFMigrationsHistory.
  - Idempotente: revisa el esquema real antes de cada paso. Se puede ejecutar
    varias veces.
  - No carga datos: las ventas se importan después desde Admin › Ventas.

  Después: ejecuta 01-esquema-verificacion.sql. Si todo sale OK, se puede publicar.
*/
SET XACT_ABORT ON;
-- El índice filtrado de ImportRuns exige estas opciones (algunas herramientas las traen apagadas).
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF SCHEMA_ID(N'sales') IS NULL EXEC(N'CREATE SCHEMA [sales];');
GO

BEGIN TRANSACTION;

-- 1) Ejecuciones de importación.
IF OBJECT_ID(N'sales.ImportRuns', N'U') IS NULL
    CREATE TABLE [sales].[ImportRuns] (
        [Id] uniqueidentifier NOT NULL,
        [Source] nvarchar(64) NOT NULL,
        [Status] int NOT NULL,
        [Active] bit NULL,
        [From] date NOT NULL,
        [Through] date NOT NULL,
        [LastSaleDate] date NULL,
        [NextOffset] int NOT NULL,
        [AllPagesRead] bit NOT NULL,
        [Pages] int NOT NULL,
        [Invoices] int NOT NULL,
        [StartedAt] datetimeoffset NOT NULL,
        [FinishedAt] datetimeoffset NULL,
        [Error] nvarchar(512) NULL,
        CONSTRAINT [PK_ImportRuns] PRIMARY KEY ([Id])
    );

-- 2) Facturas (encabezado, con fechas, pago y montos).
IF OBJECT_ID(N'sales.Sales', N'U') IS NULL
    CREATE TABLE [sales].[Sales] (
        [Id] bigint NOT NULL IDENTITY,
        [Source] nvarchar(64) NOT NULL,
        [ExternalId] nvarchar(128) NOT NULL,
        [SaleDate] date NOT NULL,
        [Status] int NOT NULL,
        [ImportedAt] datetimeoffset NOT NULL,
        [DueDate] date NULL,
        [PaymentForm] nvarchar(80) NULL,
        [PaymentMethod] nvarchar(80) NULL,
        [Balance] decimal(19,4) NULL,
        [Discount] decimal(19,4) NULL,
        [Subtotal] decimal(19,4) NULL,
        [Tax] decimal(19,4) NULL,
        [Total] decimal(19,4) NULL,
        [TotalPaid] decimal(19,4) NULL,
        CONSTRAINT [PK_Sales] PRIMARY KEY ([Id])
    );

-- 3) Relación ítem de Alegra -> producto de la tienda.
IF OBJECT_ID(N'sales.SourceItemMappings', N'U') IS NULL
    CREATE TABLE [sales].[SourceItemMappings] (
        [Source] nvarchar(64) NOT NULL,
        [ExternalItemId] nvarchar(128) NOT NULL,
        [ProductId] int NOT NULL,
        CONSTRAINT [PK_SourceItemMappings] PRIMARY KEY ([Source], [ExternalItemId]),
        CONSTRAINT [FK_SourceItemMappings_Products_ProductId] FOREIGN KEY ([ProductId])
            REFERENCES [dbo].[Products] ([Id]) ON DELETE CASCADE
    );

-- 4) Líneas de factura.
IF OBJECT_ID(N'sales.SaleLines', N'U') IS NULL
    CREATE TABLE [sales].[SaleLines] (
        [Id] bigint NOT NULL IDENTITY,
        [SaleId] bigint NOT NULL,
        [ProductId] int NULL,
        [ExternalItemId] nvarchar(128) NOT NULL,
        [Reference] nvarchar(128) NULL,
        [Name] nvarchar(256) NULL,
        [Quantity] decimal(19,6) NOT NULL,
        [Total] decimal(19,4) NULL,
        [UnitPrice] decimal(19,4) NULL,
        CONSTRAINT [PK_SaleLines] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_SaleLines_Products_ProductId] FOREIGN KEY ([ProductId])
            REFERENCES [dbo].[Products] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_SaleLines_Sales_SaleId] FOREIGN KEY ([SaleId])
            REFERENCES [sales].[Sales] ([Id]) ON DELETE CASCADE
    );

-- 5) Columnas de las migraciones 2 y 3, por si las tablas ya existían sin ellas.
IF COL_LENGTH(N'sales.Sales', N'DueDate') IS NULL ALTER TABLE [sales].[Sales] ADD [DueDate] date NULL;
IF COL_LENGTH(N'sales.Sales', N'PaymentForm') IS NULL ALTER TABLE [sales].[Sales] ADD [PaymentForm] nvarchar(80) NULL;
IF COL_LENGTH(N'sales.Sales', N'PaymentMethod') IS NULL ALTER TABLE [sales].[Sales] ADD [PaymentMethod] nvarchar(80) NULL;
IF COL_LENGTH(N'sales.Sales', N'Balance') IS NULL ALTER TABLE [sales].[Sales] ADD [Balance] decimal(19,4) NULL;
IF COL_LENGTH(N'sales.Sales', N'Discount') IS NULL ALTER TABLE [sales].[Sales] ADD [Discount] decimal(19,4) NULL;
IF COL_LENGTH(N'sales.Sales', N'Subtotal') IS NULL ALTER TABLE [sales].[Sales] ADD [Subtotal] decimal(19,4) NULL;
IF COL_LENGTH(N'sales.Sales', N'Tax') IS NULL ALTER TABLE [sales].[Sales] ADD [Tax] decimal(19,4) NULL;
IF COL_LENGTH(N'sales.Sales', N'Total') IS NULL ALTER TABLE [sales].[Sales] ADD [Total] decimal(19,4) NULL;
IF COL_LENGTH(N'sales.Sales', N'TotalPaid') IS NULL ALTER TABLE [sales].[Sales] ADD [TotalPaid] decimal(19,4) NULL;
IF COL_LENGTH(N'sales.SaleLines', N'Total') IS NULL ALTER TABLE [sales].[SaleLines] ADD [Total] decimal(19,4) NULL;
IF COL_LENGTH(N'sales.SaleLines', N'UnitPrice') IS NULL ALTER TABLE [sales].[SaleLines] ADD [UnitPrice] decimal(19,4) NULL;

-- 6) Índices.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'sales.ImportRuns') AND name = N'IX_ImportRuns_Active')
    EXEC(N'CREATE UNIQUE INDEX [IX_ImportRuns_Active] ON [sales].[ImportRuns] ([Active]) WHERE [Active] = 1');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'sales.ImportRuns') AND name = N'IX_ImportRuns_Source_Status_FinishedAt')
    CREATE INDEX [IX_ImportRuns_Source_Status_FinishedAt] ON [sales].[ImportRuns] ([Source], [Status], [FinishedAt]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'sales.SaleLines') AND name = N'IX_SaleLines_ProductId')
    CREATE INDEX [IX_SaleLines_ProductId] ON [sales].[SaleLines] ([ProductId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'sales.SaleLines') AND name = N'IX_SaleLines_SaleId')
    CREATE INDEX [IX_SaleLines_SaleId] ON [sales].[SaleLines] ([SaleId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'sales.Sales') AND name = N'IX_Sales_SaleDate_Status')
    CREATE INDEX [IX_Sales_SaleDate_Status] ON [sales].[Sales] ([SaleDate], [Status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'sales.Sales') AND name = N'IX_Sales_Source_ExternalId')
    CREATE UNIQUE INDEX [IX_Sales_Source_ExternalId] ON [sales].[Sales] ([Source], [ExternalId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'sales.SourceItemMappings') AND name = N'IX_SourceItemMappings_ProductId')
    CREATE INDEX [IX_SourceItemMappings_ProductId] ON [sales].[SourceItemMappings] ([ProductId]);

-- 7) Historial de migraciones de EF.
IF NOT EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261126174219_AddSalesImport')
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20261126174219_AddSalesImport', N'10.0.8');
IF NOT EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261126185653_AddSaleInvoiceDetails')
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20261126185653_AddSaleInvoiceDetails', N'10.0.8');
IF NOT EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261126190617_AddSaleInvoiceAmounts')
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20261126190617_AddSaleInvoiceAmounts', N'10.0.8');

COMMIT TRANSACTION;
GO
