using MagicBeauty.Store.Application.Features.Sales;
using MagicBeauty.Store.Domain.Entities;
using MagicBeauty.Store.Integrations.Alegra.Client;
using MagicBeauty.Store.Integrations.Alegra.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MagicBeauty.Store.Integrations.Alegra.Sync;

internal sealed class AlegraSalesSource(
    AlegraClient client, AlegraDbContext db, IOptions<AlegraOptions> options) : ISalesSource
{
    public string Source => "alegra";
    public bool IsEnabled => options.Value.Enabled && options.Value.IsConfigured;

    public async Task<IReadOnlyDictionary<string, int>> GetItemMappingsAsync(CancellationToken cancellationToken) =>
        await db.ProductLinks.AsNoTracking().ToDictionaryAsync(x => x.AlegraItemId, x => x.ProductId, cancellationToken);

    public async Task<SalesBatch> ReadAsync(DateOnly from, DateOnly through, int offset, CancellationToken cancellationToken)
    {
        const int pageSize = 30;
        var invoices = await client.GetInvoicesAsync(from, through, offset, pageSize, cancellationToken);
        var sales = new List<ImportedSale>();
        foreach (var invoice in invoices)
        {
            var id = invoice.Id;
            if (string.IsNullOrWhiteSpace(id) || invoice.Date < from || invoice.Date > through)
                throw new SalesSourceReadException("La respuesta de facturas no respeta el intervalo solicitado.");

            var detail = invoice.Items is null ? await client.GetInvoiceAsync(id, cancellationToken) : invoice;
            if (detail.Id != id || detail.Date < from || detail.Date > through || detail.Items is null)
                throw new SalesSourceReadException("No se pudo validar el detalle de una factura.");

            var status = detail.Status?.ToLowerInvariant() switch
            {
                "open" => SaleStatus.Open,
                "closed" => SaleStatus.Closed,
                "draft" => SaleStatus.Draft,
                "void" or "voided" => SaleStatus.Voided,
                _ => SaleStatus.Unknown
            };
            var lines = detail.Items.Select(item => new ImportedSaleLine(
                item.Id ?? "", item.Reference, item.Name,
                item.Quantity ?? throw new SalesSourceReadException("Una línea de factura no contiene una cantidad válida."))
            {
                UnitPrice = item.Price,
                Total = item.Total
            }).ToArray();
            sales.Add(new ImportedSale(id, detail.Date, status, lines)
            {
                DueDate = DateOnly.TryParseExact(detail.DueDate ?? invoice.DueDate, "yyyy-MM-dd",
                    System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None,
                    out var dueDate) ? dueDate : null,
                PaymentForm = PaymentLabel(detail.PaymentForm ?? invoice.PaymentForm, true),
                PaymentMethod = PaymentLabel(detail.PaymentMethod ?? invoice.PaymentMethod, false),
                Subtotal = detail.Subtotal ?? invoice.Subtotal,
                Discount = detail.Discount ?? invoice.Discount,
                Tax = detail.Tax ?? invoice.Tax,
                Total = detail.Total ?? invoice.Total,
                TotalPaid = detail.TotalPaid ?? invoice.TotalPaid,
                Balance = detail.Balance ?? invoice.Balance
            });
        }

        return new SalesBatch(sales, offset + invoices.Count, invoices.Count < pageSize);
    }
    private static string? PaymentLabel(string? value, bool isForm) => (value?.Trim().ToUpperInvariant(), isForm) switch
    {
        ("CASH", true) => "Contado",
        ("CREDIT", true) => "Crédito",
        ("CASH", false) => "Efectivo",
        ("CREDIT_CARD", false) => "Tarjeta de crédito",
        ("DEBIT_CARD", false) => "Tarjeta débito",
        ("BANK_DEPOSIT", false) => "Consignación bancaria",
        ("CREDIT_TRANSFER_BANK", false) => "Transferencia bancaria",
        (null or "", _) => null,
        _ => value is { Length: <= 80 } ? value.Trim() : null
    };
}
