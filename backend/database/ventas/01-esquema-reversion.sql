/*
  Ventas. REVERSIÓN de 01-esquema.sql. Úsalo solo si hay que deshacer la
  publicación, y DESPUÉS de volver a publicar el código anterior (el código
  nuevo necesita estas tablas).

  ATENCIÓN: borra las tablas del esquema [sales] con todas las ventas
  importadas. Se pueden volver a importar desde Alegra, pero se pierde el
  historial de importaciones. No toca ninguna otra tabla.
*/
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'sales.SaleLines', N'U') IS NOT NULL DROP TABLE [sales].[SaleLines];
IF OBJECT_ID(N'sales.SourceItemMappings', N'U') IS NOT NULL DROP TABLE [sales].[SourceItemMappings];
IF OBJECT_ID(N'sales.Sales', N'U') IS NOT NULL DROP TABLE [sales].[Sales];
IF OBJECT_ID(N'sales.ImportRuns', N'U') IS NOT NULL DROP TABLE [sales].[ImportRuns];

DELETE FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] IN (
    N'20261126174219_AddSalesImport',
    N'20261126185653_AddSaleInvoiceDetails',
    N'20261126190617_AddSaleInvoiceAmounts');

COMMIT TRANSACTION;
GO

IF SCHEMA_ID(N'sales') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.objects WHERE schema_id = SCHEMA_ID(N'sales'))
    EXEC(N'DROP SCHEMA [sales];');
GO
