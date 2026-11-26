/*
  Ventas. Verificación de 01-esquema.sql. Solo lectura.
  Cada fila debe decir OK. Si alguna dice FALTA, no publiques el código.
*/
SELECT Revision, CASE WHEN Ok = 1 THEN 'OK' ELSE 'FALTA' END AS Resultado
FROM (VALUES
    (N'Esquema sales',                         CASE WHEN SCHEMA_ID(N'sales') IS NOT NULL THEN 1 ELSE 0 END),
    (N'Tabla sales.ImportRuns',                CASE WHEN OBJECT_ID(N'sales.ImportRuns', N'U') IS NOT NULL THEN 1 ELSE 0 END),
    (N'Tabla sales.Sales',                     CASE WHEN OBJECT_ID(N'sales.Sales', N'U') IS NOT NULL THEN 1 ELSE 0 END),
    (N'Tabla sales.SaleLines',                 CASE WHEN OBJECT_ID(N'sales.SaleLines', N'U') IS NOT NULL THEN 1 ELSE 0 END),
    (N'Tabla sales.SourceItemMappings',        CASE WHEN OBJECT_ID(N'sales.SourceItemMappings', N'U') IS NOT NULL THEN 1 ELSE 0 END),
    (N'Sales: columnas de detalle (3)',        CASE WHEN (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'sales.Sales')
                                                    AND name IN (N'DueDate', N'PaymentForm', N'PaymentMethod')) = 3 THEN 1 ELSE 0 END),
    (N'Sales: columnas de montos (6)',         CASE WHEN (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'sales.Sales')
                                                    AND name IN (N'Subtotal', N'Discount', N'Tax', N'Total', N'TotalPaid', N'Balance')) = 6 THEN 1 ELSE 0 END),
    (N'SaleLines: UnitPrice y Total',          CASE WHEN (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'sales.SaleLines')
                                                    AND name IN (N'UnitPrice', N'Total')) = 2 THEN 1 ELSE 0 END),
    (N'Índices (7)',                           CASE WHEN (SELECT COUNT(*) FROM sys.indexes WHERE name IN (
                                                    N'IX_ImportRuns_Active', N'IX_ImportRuns_Source_Status_FinishedAt', N'IX_SaleLines_ProductId',
                                                    N'IX_SaleLines_SaleId', N'IX_Sales_SaleDate_Status', N'IX_Sales_Source_ExternalId',
                                                    N'IX_SourceItemMappings_ProductId')
                                                    AND OBJECT_SCHEMA_NAME(object_id) = N'sales') = 7 THEN 1 ELSE 0 END),
    (N'Índice único filtrado ImportRuns',      CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'sales.ImportRuns')
                                                    AND name = N'IX_ImportRuns_Active' AND is_unique = 1 AND has_filter = 1) THEN 1 ELSE 0 END),
    (N'Llaves foráneas (3)',                   CASE WHEN (SELECT COUNT(*) FROM sys.foreign_keys WHERE name IN (
                                                    N'FK_SaleLines_Products_ProductId', N'FK_SaleLines_Sales_SaleId',
                                                    N'FK_SourceItemMappings_Products_ProductId')) = 3 THEN 1 ELSE 0 END),
    (N'Historial EF (3 migraciones)',          CASE WHEN (SELECT COUNT(*) FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] IN (
                                                    N'20261126174219_AddSalesImport', N'20261126185653_AddSaleInvoiceDetails',
                                                    N'20261126190617_AddSaleInvoiceAmounts')) = 3 THEN 1 ELSE 0 END)
) AS checks (Revision, Ok);
