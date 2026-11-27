using MagicBeauty.Store.Domain.Entities;

namespace MagicBeauty.Store.Application.Features.Sales;

public sealed record ImportedSale(string ExternalId, DateOnly SaleDate, SaleStatus Status, IReadOnlyList<ImportedSaleLine> Lines)
{
    public string? CustomerExternalId { get; init; }
    public string? CustomerDocumentNumber { get; init; }
    public DateOnly? DueDate { get; init; }
    public string? PaymentForm { get; init; }
    public string? PaymentMethod { get; init; }
    public decimal? Subtotal { get; init; }
    public decimal? Discount { get; init; }
    public decimal? Tax { get; init; }
    public decimal? Total { get; init; }
    public decimal? TotalPaid { get; init; }
    public decimal? Balance { get; init; }
}

public sealed record ImportedSaleLine(string ExternalItemId, string? Reference, string? Name, decimal Quantity)
{
    public decimal? UnitPrice { get; init; }
    public decimal? Total { get; init; }
}

public sealed record SalesBatch(IReadOnlyList<ImportedSale> Sales, int NextOffset, bool Complete);

public interface ISalesBatchWriter
{
    Task WriteAsync(Guid runId, SalesBatch batch, CancellationToken cancellationToken);
}
